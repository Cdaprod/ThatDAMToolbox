#!/usr/bin/env python3

"""
Entry point for the `video` package CLI.
Can be run as `python main.py` or `./main.py`
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from video.__main__ import main

if __name__ == "__main__":
    main()