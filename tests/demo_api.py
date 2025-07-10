#!/usr/bin/env python3
"""
Human-friendly showcase using the above client – great for notebooks.
"""
from api_client import VideoAPIClient, _pretty

c = VideoAPIClient()
print("✅ Health");  _pretty(c.health())
print("\n📦 Batches"); _pretty(c.batches())
print("\n🔍 Search 'mp4'"); _pretty(c.search("mp4", limit=3))