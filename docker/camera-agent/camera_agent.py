# camera_agent.py
import os, asyncio, json, base64
import cv2, websockets

DEVICE_ID  = os.environ["DEVICE_ID"]     # e.g. "cam-livingroom"
SERVER_URI = os.environ["SERVER_WS"]     # ws://central:8080/ws/camera

async def run():
    cap = cv2.VideoCapture(0)
    async with websockets.connect(f"{SERVER_URI}?deviceId={DEVICE_ID}") as ws:
        while True:
            ret, frame = cap.read()
            if not ret: break
            _, buf = cv2.imencode('.jpg', frame)
            data = base64.b64encode(buf).decode()
            await ws.send(json.dumps({
              "device": DEVICE_ID,
              "frame": data,
            }))
            await asyncio.sleep(0.033)
    cap.release()

if __name__ == "__main__":
    asyncio.run(run())