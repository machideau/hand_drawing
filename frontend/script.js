document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const skeletonCanvas = document.getElementById('skeleton-canvas');
    const cursorFollower = document.getElementById('cursor-follower');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const modeText = document.getElementById('mode-text');
    const clearBtn = document.getElementById('clear-btn');
    const colorOptions = document.querySelectorAll('.color-option');

    let ws = null;
    let mode = 'navigation';
    let currentColor = '#38bdf8';
    let lineWidth = 5;

    // Object-based drawing state
    let strokes = []; // Array of { color, points: [{x, y}] }
    let currentStroke = null;
    let grabbedStroke = null;
    let grabOffset = { x: 0, y: 0 };

    const ctx = canvas.getContext('2d');
    const skeletonCtx = skeletonCanvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        skeletonCanvas.width = window.innerWidth;
        skeletonCanvas.height = window.innerHeight;
        render();
    }

    window.addEventListener('resize', resize);
    resize();

    function connect() {
        ws = new WebSocket('ws://localhost:8000/ws');
        ws.onopen = () => {
            statusDot.classList.add('active');
            statusText.innerText = 'Tracking Active';
        };
        ws.onclose = () => {
            statusDot.classList.remove('active');
            statusText.innerText = 'Disconnected';
            setTimeout(connect, 2000);
        };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleTrackingData(data);
        };
    }

    function handleTrackingData(data) {
        if (!data.detected) {
            currentStroke = null;
            grabbedStroke = null;
            clearSkeleton();
            return;
        }

        const { landmarks, mode: currentMode, cursor: currentCursor } = data;
        const x = currentCursor.x * canvas.width;
        const y = currentCursor.y * canvas.height;

        updateUI(currentMode, x, y);

        if (currentMode === 'drawing') {
            if (!currentStroke) {
                currentStroke = { color: currentColor, points: [{ x, y }] };
                strokes.push(currentStroke);
            } else {
                currentStroke.points.push({ x, y });
            }
            grabbedStroke = null;
        } else if (currentMode === 'selection') {
            // Grab & Move Logic
            if (!grabbedStroke) {
                grabbedStroke = findClosestStroke(x, y);
                if (grabbedStroke) {
                    const firstPoint = grabbedStroke.points[0];
                    grabOffset = { x: x - firstPoint.x, y: y - firstPoint.y };
                }
            } else {
                moveStroke(grabbedStroke, x - grabOffset.x, y - grabOffset.y);
            }
            currentStroke = null;
        } else if (currentMode === 'eraser') {
            eraseStrokesAt(x, y);
            currentStroke = null;
            grabbedStroke = null;
        } else {
            currentStroke = null;
            grabbedStroke = null;
        }

        checkColorPaletteHover(x, y);
        render();
        drawSkeleton(landmarks);
    }

    function updateUI(currentMode, x, y) {
        mode = currentMode;
        modeText.innerText = `Mode: ${mode.toUpperCase()}`;
        cursorFollower.style.left = `${x}px`;
        cursorFollower.style.top = `${y}px`;

        cursorFollower.className = 'cursor-follower ' + mode;
        if (grabbedStroke) cursorFollower.classList.add('grabbing');

        cursorFollower.style.borderColor = (mode === 'drawing') ? currentColor : (grabbedStroke ? '#fbbf24' : 'white');
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokes.forEach(stroke => {
            if (stroke.points.length < 1) return;

            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (stroke === grabbedStroke) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = stroke.color;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
        ctx.shadowBlur = 0; // Reset
    }

    function findClosestStroke(x, y) {
        let closest = null;
        let minDist = 50; // Max grab distance

        strokes.forEach(stroke => {
            stroke.points.forEach(p => {
                const dist = Math.hypot(p.x - x, p.y - y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = stroke;
                }
            });
        });
        return closest;
    }

    function moveStroke(stroke, newX, newY) {
        if (!stroke.points.length) return;
        const dx = newX - stroke.points[0].x;
        const dy = newY - stroke.points[0].y;

        stroke.points.forEach(p => {
            p.x += dx;
            p.y += dy;
        });
    }

    function eraseStrokesAt(x, y) {
        const radius = 40;
        strokes = strokes.filter(stroke => {
            const isNear = stroke.points.some(p => Math.hypot(p.x - x, p.y - y) < radius);
            return !isNear;
        });
    }

    function checkColorPaletteHover(x, y) {
        colorOptions.forEach(option => {
            const rect = option.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                if (currentColor !== option.dataset.color) {
                    selectColor(option);
                }
            }
        });
    }

    function selectColor(option) {
        colorOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentColor = option.dataset.color;
        // Visual feedback
        option.style.transform = 'scale(1.3)';
        setTimeout(() => option.style.transform = '', 200);
    }

    function drawSkeleton(landmarks) {
        skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
        skeletonCtx.fillStyle = '#38bdf8';
        skeletonCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        skeletonCtx.lineWidth = 3;

        const connections = [
            [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 17, 18, 19, 20],
            [5, 9, 13, 17], [9, 10, 11, 12], [13, 14, 15, 16]
        ];

        connections.forEach(path => {
            skeletonCtx.beginPath();
            path.forEach((id, idx) => {
                const lm = landmarks.find(l => l.id === id);
                if (lm) {
                    const lx = lm.x * skeletonCanvas.width;
                    const ly = lm.y * skeletonCanvas.height;
                    if (idx === 0) skeletonCtx.moveTo(lx, ly);
                    else skeletonCtx.lineTo(lx, ly);
                }
            });
            skeletonCtx.stroke();
        });

        landmarks.forEach(lm => {
            skeletonCtx.beginPath();
            skeletonCtx.arc(lm.x * skeletonCanvas.width, lm.y * skeletonCanvas.height, 4, 0, Math.PI * 2);
            skeletonCtx.fill();
        });
    }

    function clearSkeleton() {
        skeletonCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
    }

    clearBtn.addEventListener('click', () => {
        strokes = [];
        render();
    });

    colorOptions.forEach(option => {
        option.addEventListener('click', () => selectColor(option));
    });

    connect();
});
