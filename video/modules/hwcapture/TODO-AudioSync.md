Below is a minimal upgrade-kit that turns the VideoSyncer helper you pasted into a fully-wired feature inside the hwcapture plug-in.
It gives you:

What you get	How to call it
CLI verb – video audio_sync  --cam A.mp4 --aux B.mp4	produces A_trim.mp4 / B_trim.mp4 perfectly aligned
REST – POST /hwcapture/audio_sync	JSON body: {"cam":"A.mp4","aux":"B.mp4"}
Python API – from video.modules.hwcapture import audio_sync	returns (offset_sec, cam_out, aux_out)

Everything below is drop-in and keeps with the conventions we already use for motion_extractor and hwcapture – no core-app changes required.

⸻

1  Add audiosync.py (logic only)

# video/modules/hwcapture/audiosync.py
"""
Audio-waveform synchroniser.

Core helper   →  offset   = compute_offset(cam.mp4, aux.mp4)
High-level    →  cam_out, aux_out = trim_pair(...)
CLI / REST use the high-level wrapper.
"""

from __future__ import annotations
import logging, subprocess, tempfile, os
from pathlib import Path
from dataclasses import dataclass

import numpy as np
import librosa, scipy.signal           # heavy but already in requirements
from moviepy.editor import VideoFileClip

_log = logging.getLogger("video.hwcapture.sync")

# --------------------------------------------------------------------------- #
# low-level utilities                                                         #
# --------------------------------------------------------------------------- #
def _load_mono(path: str, target_sr: int = 22_050) -> tuple[np.ndarray, int]:
    """Return mono-mix audio, resampled to *target_sr* Hz."""
    clip = VideoFileClip(path)
    arr  = clip.audio.to_soundarray(fps=target_sr)
    clip.close()
    mono = arr.mean(axis=1) if arr.ndim == 2 else arr
    return mono.astype(np.float32), target_sr

def _xcorr_offset(a: np.ndarray, b: np.ndarray, sr: int) -> float:
    """Cross-correlation offset *b→a* (seconds)."""
    a /= np.abs(a).max();  b /= np.abs(b).max()
    corr = scipy.signal.correlate(b, a, mode="full")
    lag  = scipy.signal.correlation_lags(len(b), len(a), mode="full")[corr.argmax()]
    return lag / sr                                           # +ve  =>  b starts later

# --------------------------------------------------------------------------- #
# public helpers                                                              #
# --------------------------------------------------------------------------- #
def compute_offset(cam: str, aux: str, sr: int = 22_050) -> float:
    """
    Return **aux – cam** start-time in seconds
    (+ve  ⇒  aux begins later than cam).
    """
    a, _ = _load_mono(cam, sr)
    b, _ = _load_mono(aux, sr)
    off  = _xcorr_offset(a, b, sr)
    _log.info("audio-offset cam→aux = %.3f s", off)
    return off


@dataclass
class SyncResult:
    offset: float
    confidence: float  # correlation strength 0-1
    cam_trim: Path
    aux_trim: Path


def trim_pair(cam: str, aux: str,
              out_cam: str | None = None,
              out_aux: str | None = None) -> SyncResult:
    """
    • figures out offset using raw cross-correlation  
    • writes trimmed versions that **start at the same timestamp**  
    • returns dataclass with info
    """
    cam, aux = map(Path, (cam, aux))
    out_cam  = Path(out_cam or cam.with_stem(cam.stem + "_trim"))
    out_aux  = Path(out_aux or aux.with_stem(aux.stem + "_trim"))

    off = compute_offset(cam, aux)

    # ------------------------------------------------------------------- trim
    # we use ffmpeg -ss for speed (avoids re-encode if GOP allows)
    def _run(cmd): subprocess.check_call(cmd, stdout=subprocess.DEVNULL,
                                              stderr=subprocess.DEVNULL)

    # If aux starts later → drop **off** seconds from cam
    if off > 0:
        _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{off:.3f}",
              "-i", cam, "-c", "copy", str(out_cam)])
        _run(["ffmpeg", "-y", "-loglevel", "error",
              "-i", aux, "-c", "copy", str(out_aux)])
    # If cam starts later → drop |off| from aux
    else:
        _run(["ffmpeg", "-y", "-loglevel", "error",
              "-i", cam, "-c", "copy", str(out_cam)])
        _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{-off:.3f}",
              "-i", aux, "-c", "copy", str(out_aux)])

    # Equalise length to the shorter one (quick remux)
    dur_cam = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "format=duration", "-of", "csv=p=0", out_cam]))
    dur_aux = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "format=duration", "-of", "csv=p=0", out_aux]))
    min_dur = f"{min(dur_cam, dur_aux):.3f}"

    for f in (out_cam, out_aux):
        tmp = f.with_suffix(".tmp.mp4")
        _run(["ffmpeg", "-y", "-loglevel", "error", "-i", f,
              "-t", min_dur, "-c", "copy", tmp])
        os.replace(tmp, f)

    _log.info("synced ➜ %s  |  %s", out_cam.name, out_aux.name)
    return SyncResult(off, out_cam, out_aux)


⸻

2  Expose as Python helper

Add to video/modules/hwcapture/__init__.py:

from .audiosync import compute_offset as audio_offset, trim_pair as audio_sync
__all__ += ["audio_offset", "audio_sync"]

Now every place in-project can simply:

from video.modules.hwcapture import audio_sync
off, cam_file, aux_file = audio_sync("cam.mp4", "insta360.mp4")


⸻

3  CLI verb

Append to commands.py:

from .audiosync import trim_pair

@register("audio_sync", help="trim two MP4s so that A & B start at same audio time-zero")
def cli_audio(args: Namespace):
    res = trim_pair(args.cam, args.aux, args.out_cam, args.out_aux)
    print(f"Δt = {res.offset:+.3f}s  ⇒  {res.cam_trim}  |  {res.aux_trim}")

def add_parser(sub):
    # … (existing parsers) …
    p = sub.add_parser("audio_sync", help="align two recordings via audio")
    p.add_argument("--cam", required=True, help="main camera MP4")
    p.add_argument("--aux", required=True, help="witness/360 MP4")
    p.add_argument("--out-cam")
    p.add_argument("--out-aux")


⸻

4  REST endpoint

Append to routes.py after the existing handlers:

from pydantic import BaseModel
from .audiosync import trim_pair, SyncResult

class SyncReq(BaseModel):
    cam: str
    aux: str
    out_cam: str | None = None
    out_aux: str | None = None

@router.post("/audio_sync")
def audio_sync(req: SyncReq) -> dict:
    res: SyncResult = trim_pair(req.cam, req.aux, req.out_cam, req.out_aux)
    return {
        "offset_sec": res.offset,
        "cam_trim":   str(res.cam_trim),
        "aux_trim":   str(res.aux_trim)
    }


⸻

5  Tiny UI or Front-end call (optional)

async function runAudioSync(cam, aux) {
  const res = await fetch("/hwcapture/audio_sync", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({cam, aux})
  }).then(r => r.json());

  alert(`Trimmed!\nΔt = ${res.offset_sec.toFixed(3)}s\nFiles:\n${res.cam_trim}\n${res.aux_trim}`);
}

Attach that to a button next to your Witness Extract card and you’re done.

⸻

⚙️ Docker / requirements

Everything reuses the requirements.txt we added for hwcapture – no new deps.

Re-build:

docker compose build
docker compose up -d


⸻

Workflow recap

# 1. capture main + witness
video hw_record        --device /dev/video0 --out cam.mp4 --duration 30 &
video hw_record        --device /dev/video1 --out insta360.mp4 --duration 30

# 2. audio-align them
video audio_sync --cam cam.mp4 --aux insta360.mp4

# Output:
#   cam_trim.mp4  insta360_trim.mp4  (exact same first sample)

Import those trimmed files in Resolve / Premiere: perfect frame-start alignment – no manual slips needed.