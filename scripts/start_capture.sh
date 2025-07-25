#!/usr/bin/env bash
#### UDEV Rule & FFMPEG Wrapper ######
## /etc/udev/rules.d/99-video.rules
## SUBSYSTEM=="video4linux", ATTRS{idVendor}=="1912", ATTRS{idProduct}=="0030", SYMLINK+="camera0"
######################################
DEVICE=/dev/camera0
RES=${WIDTH:-1920}x${HEIGHT:-1080}
FPS=${FPS:-30}

# Round FPS
FPS_ROUNDED=$(printf "%.0f" "$FPS")

exec ffmpeg \
  -f v4l2 -framerate $FPS_ROUNDED -video_size $RES \
  -i $DEVICE \
  -c:v h264_vaapi -b:v 4M \
  -f mpegts udp://127.0.0.1:5000