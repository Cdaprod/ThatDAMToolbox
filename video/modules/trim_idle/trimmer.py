"""
/video/modules/trim_idle/trimmer.py

Core engine used by both the CLI command and REST endpoint.
Implements two strategies:

• **FFmpeg**  : uses `freezedetect` + smart concat (fast, no Python CV required)
• **OpenCV**  : full-Python fallback with per-pixel MSE (flexible, inspectable)

Install requirements:
    pip install opencv-python tqdm
and make sure FFmpeg/FFprobe are on $PATH.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable, List, Tuple, Literal, Optional

import cv2
import numpy as np
from tqdm import tqdm


class TrimIdleProcessor:
    """Detect and *remove* idle segments from screen-recordings or screencasts."""

    def __init__(
        self,
        src: str | Path,
        dst: str | Path,
        method: Literal["ffmpeg", "opencv"] = "ffmpeg",
        *,
        noise: float = 0.003,
        freeze_dur: float = 0.10,
        pix_thresh: float = 2.0,
    ):
        self.src = Path(src)
        self.dst = Path(dst)
        self.method = method
        self.noise = noise
        self.freeze_dur = freeze_dur
        self.pix_thresh = pix_thresh

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #
    def run(self) -> Path:
        """Run the chosen strategy and return the output path."""
        if self.method == "ffmpeg":
            return self._run_ffmpeg()
        if self.method == "opencv":
            return self._run_opencv()
        raise ValueError(f"Unsupported method: {self.method}")

    # --------------------------------------------------------------------- #
    # FFmpeg strategy
    # --------------------------------------------------------------------- #
    FREEZE_START = re.compile(r"freeze_start.+?pts_time:(\d+\.\d+)")
    FREEZE_END = re.compile(r"freeze_end.+?pts_time:(\d+\.\d+)")

    def _detect_freezes_ffmpeg(self, log_path: Path) -> None:
        """Run freezedetect and pipe stderr to *log_path*."""
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(self.src),
            "-vf",
            f"freezedetect=n={self.noise}:d={self.freeze_dur}",
            "-an",
            "-f",
            "null",
            "-",
        ]
        with log_path.open("w") as fh:
            subprocess.run(cmd, check=True, stderr=fh)

    @staticmethod
    def _parse_freeze_log(log_path: Path) -> List[Tuple[float, float]]:
        txt = log_path.read_text()
        starts = list(map(float, TrimIdleProcessor.FREEZE_START.findall(txt)))
        ends = list(map(float, TrimIdleProcessor.FREEZE_END.findall(txt)))
        if len(starts) != len(ends):
            raise RuntimeError("freeze_start / freeze_end mismatch in log")
        return sorted(zip(starts, ends))

    @staticmethod
    def _invert_ranges(
        frozen: Iterable[Tuple[float, float]], total: float
    ) -> List[Tuple[float, float]]:
        keep, last = [], 0.0
        for s, e in frozen:
            if s > last:
                keep.append((last, s))
            last = e
        if last < total:
            keep.append((last, total))
        return keep

    def _run_ffmpeg(self) -> Path:
        if shutil.which("ffmpeg") is None:
            raise EnvironmentError("FFmpeg not found on PATH")

        with tempfile.TemporaryDirectory() as td:
            freeze_log = Path(td) / "freeze.log"
            self._detect_freezes_ffmpeg(freeze_log)
            frozen = self._parse_freeze_log(freeze_log)

        # total duration
        duration = float(
            subprocess.check_output(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-of",
                    "csv=p=0",
                    "-show_entries",
                    "format=duration",
                    str(self.src),
                ]
            )
            .decode()
            .strip()
        )
        keep = self._invert_ranges(frozen, duration)

        # build trim filters
        vf = ",".join(
            f"trim=start={s}:end={e},setpts=PTS-STARTPTS" for s, e in keep
        )
        af = ",".join(
            f"atrim=start={s}:end={e},asetpts=PTS-STARTPTS" for s, e in keep
        )

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-i",
            str(self.src),
            "-vf",
            vf,
            "-af",
            af,
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(self.dst),
        ]
        subprocess.run(cmd, check=True)
        return self.dst

    # --------------------------------------------------------------------- #
    # OpenCV strategy
    # --------------------------------------------------------------------- #
    def _run_opencv(self) -> Path:
        cap = cv2.VideoCapture(str(self.src))
        if not cap.isOpened():
            raise IOError(f"Could not open {self.src}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        idle_frames = int(self.freeze_dur * fps)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        idle_ranges: List[Tuple[float, float]] = []

        ok, prev = cap.read()
        frame_idx, idle_cnt, start_idle = 0, 0, None

        with tqdm(total=total_frames, desc="Scanning", unit="frame") as bar:
            while ok:
                ok, curr = cap.read()
                if not ok:
                    break

                diff = self._mse(
                    cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY),
                    cv2.cvtColor(curr, cv2.COLOR_BGR2GRAY),
                )
                if diff < self.pix_thresh:
                    idle_cnt += 1
                    if idle_cnt == idle_frames:
                        start_idle = frame_idx - idle_frames + 1
                else:
                    if start_idle is not None:
                        idle_ranges.append(
                            (
                                start_idle / fps,
                                frame_idx / fps,
                            )
                        )
                        start_idle = None
                    idle_cnt = 0

                prev = curr
                frame_idx += 1
                bar.update(1)

        # tail idle?
        if start_idle is not None:
            idle_ranges.append((start_idle / fps, frame_idx / fps))
        cap.release()

        return self._concat_keep_ranges_opencv(idle_ranges, fps)

    @staticmethod
    def _mse(a: np.ndarray, b: np.ndarray) -> float:
        return float(((a.astype("float") - b.astype("float")) ** 2).mean())

    def _concat_keep_ranges_opencv(
        self,
        idle_ranges: List[Tuple[float, float]],
        fps: float,
    ) -> Path:
        # invert to keep ranges
        duration = sum(
            1
            for _ in cv2.VideoCapture(str(self.src)).read()
        )  # fallback; avoids extra ffprobe
        keep = self._invert_ranges(idle_ranges, duration / fps)

        # concat demux list
        concat_file = self.dst.with_suffix(".concat.txt")
        with concat_file.open("w") as fh:
            for s, e in keep:
                fh.write(f"file '{self.src.as_posix()}'\n")
                fh.write(f"inpoint {s}\n")
                fh.write(f"outpoint {e}\n")

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            str(self.dst),
        ]
        subprocess.run(cmd, check=True)
        concat_file.unlink(missing_ok=True)
        return self.dst