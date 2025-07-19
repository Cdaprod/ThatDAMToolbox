# /video/modules/hwcapture/commands.py

"""
Command-line verbs that piggy-back on your main `video` CLI.

• video hw_list
• video hw_record  --device /dev/video0 --out clip.mp4 --dur 30
"""

import time
from pathlib import Path
from argparse import Namespace
from video.cli import register            # decorator from your framework
from .hwcapture import (
    list_video_devices, HWAccelRecorder, has_hardware_accel
)

@register("hw_list", help="list v4l2 devices with resolution/FPS")
def cli_hw_list(_: Namespace):
    for dev in list_video_devices():
        print(f"{dev['path']}  {dev['width']}×{dev['height']}  {dev['fps']}fps")

@register("hw_record", help="hardware-accelerated recorder")
def cli_hw_record(args: Namespace):
    rec = HWAccelRecorder(device=args.device, output_file=args.out)
    rec.start_recording_hw("h264")
    try:
        if args.duration:
            time.sleep(args.duration)
        else:
            print("Recording… press Ctrl-C to stop")
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        rec.stop_recording()
        
@register("witness_record",
          help="record main feed with witness-based stabilisation")
def cli_witness(args):
    from .hwcapture import record_with_witness
    record_with_witness(main_dev=args.main,
                        witness_dev=args.witness,
                        out_main=args.raw,
                        out_corr=args.stab,
                        duration=args.duration)

def add_parser(sub):
    # automatically called by your core CLI builder
    p = sub.add_parser("hw_record", help="HW accelerated recorder")
    p.add_argument("--device", default="/dev/video0")
    p.add_argument("--out",   type=Path, default="capture.mp4")
    p.add_argument("--duration", type=int, help="limit seconds")
    
    p = sub.add_parser("witness_record", help="record with witness tracking")
    p.add_argument("--main",    default="/dev/video0")
    p.add_argument("--witness", default="/dev/video1")
    p.add_argument("--raw",     default="main_raw.mp4")
    p.add_argument("--stab",    default="main_stab.mp4")
    p.add_argument("--duration", type=int, default=60)