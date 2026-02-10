# Hand Drawing Project

A real-time hand-tracking drawing application using Python (FastAPI, OpenCV, MediaPipe) and a vanilla JavaScript frontend.

## Features
- Real-time hand landmark detection.
- Gesture-based controls (Drawing, Navigation, Eraser, Selection).
- WebSocket-based communication between backend and frontend.

## Installation

### Prerequisites
- Python 3.8+
- A webcam

### Setup
1. Clone the repository.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage
1. Run the backend:
   ```bash
   python backend/main.py
   ```
2. The browser will open automatically or you can open `frontend/index.html`.
