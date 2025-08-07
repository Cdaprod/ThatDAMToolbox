# FFmpeg Console Module

Exposes a thin wrapper around `ffmpeg` so commands can be executed from the web UI or CLI.

Routes:

- `POST /ffmpeg/run` – execute an ffmpeg command and stream logs

CLI verb:

```bash
python -m video ffmpeg "-i in.mp4 out.gif"
```

Extra dependencies are listed in `requirements.txt` and must be installed separately.

