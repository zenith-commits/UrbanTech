# UrbanTech 🚍

### AI-Powered Mobile Urban Intelligence Platform

UrbanTech turns public-transport buses into **mobile urban sensing units** using cameras, GPS, AI-based detection, and GIS visualization.

### What it does

- 📹 Live webcam feed
- 📍 Real-time GPS tracking
- 🤖 AI object & hazard detection simulation
- 🗺️ Live GIS map with event markers
- 🚨 Real-time alerts & "Needs Attention"
- 🚌 Fleet monitoring
- 📊 Urban intelligence analytics
- ✅ Event verification & maintenance actions

### Tech Stack

React · TypeScript · Vite · Tailwind CSS · Leaflet · OpenStreetMap

### Run Locally

```bash
cd urban-intelligence
npm install
npm run dev

Open the localhost URL shown in the terminal.

For the full demo, allow camera and location permissions in your browser.

Prototype Flow
CAMERA + GPS
     ↓
DETECTION
     ↓
URBAN EVENT
     ↓
GIS MAP + ALERT
     ↓
VERIFY → ACT
Note

This is a Smart India Hackathon 2026 prototype. Webcam and GPS can use real browser capabilities; AI detection and some fleet/event data are simulated for demonstration.

Team Rocket

give me the entire readme file containing everything just to coppy paste 

Copy-paste this entire file as your README.md:

# UrbanTech 🚍

## AI-Powered Mobile Urban Intelligence Platform

UrbanTech transforms public-transport buses into **mobile urban sensing units** using cameras, GPS, AI-based detection, and GIS visualization.

Built as a **Smart India Hackathon 2026 prototype** by **Team Rocket**.

---

## 🚀 Features

- 📹 **Live Webcam** — Real browser camera feed
- 📍 **GPS Tracking** — Real-time browser location with demo fallback
- 🤖 **AI Detection** — Frontend simulation of object and road-hazard detection
- 🗺️ **Live GIS Map** — Bus locations and detected events
- 🚨 **Alerts** — Priority-based urban incident alerts
- 🚌 **Fleet Monitoring** — Monitor active and idle buses
- 📊 **Analytics** — Detection and urban-event statistics
- ✅ **Event Verification** — Verify detected incidents
- 🔧 **Maintenance Actions** — Convert verified events into actionable alerts
- 🎮 **Demo Mode** — Simulate live detections and events for demonstrations

---

## 🔄 System Flow

```text
Camera + GPS
     ↓
Object / Hazard Detection
     ↓
Urban Event Generation
     ↓
Live GIS Map + Alerts
     ↓
Verify Event
     ↓
Maintenance Action
🛠️ Tech Stack
React
TypeScript
Vite
Tailwind CSS
Leaflet
React Leaflet
OpenStreetMap
Lucide React
Browser MediaDevices API
Browser Geolocation API
📁 Project Structure
UrbanTech/
│
├── backend/
├── scripts/
│
└── urban-intelligence/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── hooks/
    │   ├── services/
    │   ├── types/
    │   └── ...
    │
    ├── package.json
    ├── vite.config.ts
    └── README.md
💻 Run Locally
1. Clone the repository
git clone https://github.com/zenith-commits/UrbanTech.git
cd UrbanTech
2. Enter the frontend
cd urban-intelligence
3. Install dependencies
npm install
4. Start the development server
npm run dev

Open the localhost URL shown in the terminal.

📷 Camera & GPS

For the complete prototype experience:

Allow camera access when prompted.
Allow location access when prompted.

The webcam uses the browser's real camera.

GPS uses the browser's real geolocation when available. If GPS is unavailable, the application can use Demo GPS for testing and demonstrations.

🤖 AI Detection

The current prototype uses a frontend detection simulation to demonstrate the complete AI → event → GIS workflow without requiring a backend inference server.

Supported demonstration detections include:

Person
Car
Bus
Motorcycle
Bicycle
Pothole

Production deployment can replace the simulation with an actual edge-AI/YOLO inference pipeline.

🎮 Demo Mode

Enable Demo Mode to simulate:

Live detections
Urban events
Map markers
Alerts
Dashboard metrics

This allows the complete system workflow to be demonstrated without external infrastructure.

📦 Available Commands
npm run dev

Start the development server.

npm run build

Create a production build.

npm run preview

Preview the production build locally.

npm run lint

Run ESLint checks.

🏙️ Concept

UrbanTech follows:

SENSE → ANALYSE → SHARE → ACT

Public-transport vehicles already travel continuously across cities. UrbanTech explores how their cameras and GPS can be used as a distributed sensing network for identifying road conditions, traffic situations, and other urban events.

🏆 Smart India Hackathon 2026

Team: Team Rocket
Project: UrbanTech
Problem: AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet
