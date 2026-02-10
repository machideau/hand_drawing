from contextlib import asynccontextmanager
import cv2
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from hand_tracker import HandTracker

import math
import time

class OneEuroFilter:
    def __init__(self, t0, x0, min_cutoff=1.0, beta=0.0, d_cutoff=1.0):
        self.min_cutoff = float(min_cutoff)
        self.beta = float(beta)
        self.d_cutoff = float(d_cutoff)
        self.x_prev = float(x0)
        self.dx_prev = 0.0
        self.t_prev = float(t0)

    def alpha(self, cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, t, x):
        t = float(t)
        x = float(x)
        dt = t - self.t_prev
        if dt <= 0: return self.x_prev

        # Calculate derivative
        dx = (x - self.x_prev) / dt
        edx = self.dx_prev + self.alpha(self.d_cutoff, dt) * (dx - self.dx_prev)
        self.dx_prev = edx

        # Calculate cutoff based on velocity
        cutoff = self.min_cutoff + self.beta * abs(edx)
        
        # Apply filter
        x_filtered = self.x_prev + self.alpha(cutoff, dt) * (x - self.x_prev)
        
        self.x_prev = x_filtered
        self.t_prev = t
        return x_filtered

tracker = HandTracker(detection_con=0.8, track_con=0.8)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be dead
                pass

manager = ConnectionManager()
background_task = None
is_running = False

async def camera_loop():
    global is_running
    cap = cv2.VideoCapture(0)
    w_cam, h_cam = 1080, 720
    cap.set(3, w_cam)
    cap.set(4, h_cam)
    
    # Initialize OneEuroFilters
    filter_x = None
    filter_y = None
    # Params: min_cutoff (jitter), beta (lag)
    # Lower min_cutoff = more stable when slow
    # Higher beta = less lag when fast
    f_min_cutoff = 0.05
    f_beta = 0.5
    
    # Mode stability
    mode_buffer = []
    buffer_size = 5

    try:
        while is_running:
            success, img = cap.read()
            if not success:
                await asyncio.sleep(0.1)
                continue

            img = cv2.flip(img, 1)
            img = tracker.find_hands(img)
            lm_list, handedness = tracker.find_position(img, draw=False)

            data = {
                "detected": False,
                "landmarks": [],
                "mode": "navigation",
                "cursor": {"x": 0, "y": 0}
            }

            if len(lm_list) != 0:
                data["detected"] = True
                h, w, c = img.shape
                data["landmarks"] = [{"id": lm[0], "x": lm[1]/w, "y": lm[2]/h} for lm in lm_list]

                # Coordinate Mapping with Margin (to reach edges easily)
                margin = 0.15 # 15% margin
                raw_x, raw_y = lm_list[8][1] / w, lm_list[8][2] / h
                
                # Remap: [margin, 1-margin] -> [0, 1]
                target_x = (raw_x - margin) / (1 - 2 * margin)
                target_y = (raw_y - margin) / (1 - 2 * margin)
                
                # Clamp between 0 and 1
                target_x = max(0.0, min(1.0, target_x))
                target_y = max(0.0, min(1.0, target_y))
                
                curr_time = time.time()
                if filter_x is None:
                    filter_x = OneEuroFilter(curr_time, target_x, min_cutoff=f_min_cutoff, beta=f_beta)
                    filter_y = OneEuroFilter(curr_time, target_y, min_cutoff=f_min_cutoff, beta=f_beta)
                    smooth_x, smooth_y = target_x, target_y
                else:
                    smooth_x = filter_x(curr_time, target_x)
                    smooth_y = filter_y(curr_time, target_y)
                
                data["cursor"] = {"x": smooth_x, "y": smooth_y}

                fingers = tracker.fingers_up(lm_list, handedness)

                # Temp mode detection
                detected_mode = "navigation"
                if fingers[0] == 0 and fingers[1] == 0 and fingers[2] == 0 and fingers[3] == 0 and fingers[4] == 0:
                    detected_mode = "eraser"
                elif fingers[1] == 1 and fingers[2] == 1:
                    detected_mode = "navigation"
                elif fingers[1] == 1 and fingers[2] == 0:
                    detected_mode = "drawing"
                
                length, _, _ = tracker.find_distance(4, 8, lm_list, draw=False)
                if length < 65: # Increased pinch threshold for easier detection
                    detected_mode = "selection"

                # Mode hysteresis (Stability buffer)
                mode_buffer.append(detected_mode)
                if len(mode_buffer) > buffer_size:
                    mode_buffer.pop(0)
                
                # Use the most frequent mode in buffer
                data["mode"] = max(set(mode_buffer), key=mode_buffer.count)
                
            else:
                filter_x, filter_y = None, None
                mode_buffer = []

            if manager.active_connections:
                await manager.broadcast(data)

            await asyncio.sleep(0.01)

    finally:
        cap.release()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global background_task, is_running
    is_running = True
    background_task = asyncio.create_task(camera_loop())
    yield
    is_running = False
    await background_task

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, though we mostly broadcast from background
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    import webbrowser
    import os

    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html"))
    webbrowser.open(f"file://{frontend_path}")

    uvicorn.run(app, host="0.0.0.0", port=8000)
