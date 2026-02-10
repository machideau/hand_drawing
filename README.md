# Hand Drawing Project

A real-time hand-tracking drawing application powered by Python (FastAPI, OpenCV, MediaPipe) and a clean, responsive vanilla JavaScript/CSS frontend.

## Features
- **Real-time Detection**: Extremely fast hand landmark tracking using Google's MediaPipe.
- **Smart Smoothing**: One-Euro filter implementation for silky-smooth cursor movement.
- **WebSocket Communication**: Low-latency communication between the Python backend and the web frontend.
- **Multi-Mode Interface**: Dynamic interaction based on your hand gestures.

## Hand Gestures
Control the canvas with simple hand movements:

| Gesture | Mode | Description |
| :--- | :--- | :--- |
| **All Fingers Down** | Eraser | Clear parts of your drawing. |
| **Index + Middle Up** | Navigation | Move the cursor without drawing. |
| **Index Up Only** | Drawing | Start sketching on the canvas. |
| **Pinch (Index+Thumb)** | Selection | Interact with UI elements or select. |

## Project Structure
```text
hand_drawing/
├── backend/
│   ├── main.py          # FastAPI server & Gesture logic
│   ├── hand_tracker.py  # MediaPipe wrapper & Landmark detection
│   └── test_cam.py      # Utility to test your webcam
├── frontend/
│   ├── index.html       # UI Structure
│   ├── script.js        # Canvas drawing & WebSocket logic
│   └── style.css        # Premium glassmorphism design
├── .gitignore           # Python/OS excluded files
├── README.md            # You are here!
└── requirements.txt     # Python dependencies
```

## Installation

### Prerequisites
- **Python 3.10+** (Recommended)
- A working **Webcam**

### Setup Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/machideau/hand_drawing.git
   cd hand_drawing
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # Linux/macOS
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

## Usage
1. **Start the backend server**:
   ```bash
   python backend/main.py
   ```
2. The application will automatically attempt to open your default browser.
3. If it doesn't, manually open `frontend/index.html` in Chrome or Edge.

## Troubleshooting
- **Camera not detected**: Ensure no other application (Zoom, Teams, etc.) is using your webcam.
- **High Latency**: Make sure your room is well-lit for optimal MediaPipe detection.
- **Firefox Issues**: For the best performance, use a Chromium-based browser (Chrome, Edge, Brave).

---
*Created with love by Samuel (Machideau)*
