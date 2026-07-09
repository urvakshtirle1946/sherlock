# Sherlock Candidate Auditor

Sherlock is a real-time candidate verification and proctoring platform designed to automatically identify which participant in a live video meeting (e.g. Google Meet, Zoom, MS Teams) is the actual candidate by continuously fusing multiple weak biometric and behavioral signals into a single, explainable, updating confidence score.

The platform is designed in a strict, high-contrast, black-and-white compliance auditor aesthetic, utilizing monospace typography, sharp borders, and shadcn/ui components.

---

## 🔗 GitHub Repository
* **Repository Link**: [GitHub Repository](https://github.com/urvakshtirle1946/sherlock)
* **Status**: Fully Restructured Monorepo on `origin/main`

---

## 📂 Source Code Structure

The repository is structured as a monorepo:

```
├── client/                     # Next.js Frontend Application
│   ├── src/
│   │   ├── app/                # App router (dashboard and proctoring pages)
│   │   ├── components/         # Dashboard blocks (Table, Graph, Cards)
│   │   │   └── ui/             # shadcn/ui primitives (Button, Input, Card, Table)
│   │   ├── hooks/              # Socket.io, camera/pose, and tab-visibility hooks
│   │   └── store/              # Zustand global state manager
│   ├── components.json         # shadcn configuration
│   └── package.json
│
├── server/                     # Express & TypeScript Backend
│   ├── src/
│   │   ├── models/             # Mongoose schemas (Session, Signal, Prediction)
│   │   ├── routes/             # REST API routers (Sessions, Upload, Webhooks)
│   │   ├── services/           # Signal extraction & Confidence loop engines
│   │   └── index.ts            # Entry point & socket.io coordinator
│   ├── scripts/                # Utility scripts (download face-api weights)
│   └── package.json
```

---

## 💡 Assumptions Made

1. **Dual Ingestion Paths**:
   * **Live Ingestion (Recall.ai)**: Requires a public callback domain so Recall.ai's cloud servers can deliver real-time participant and transcription webhook payloads.
   * **Demo Ingestion (Simulator)**: A local-only developer shortcut designed to mock meeting participants, camera toggles, speaking states, and transcript inputs directly on the dashboard without launching real bots.
2. **Dynamic Host Resolution**:
   * If `HOST_URL` is omitted from the environment variables, the server dynamically extracts the proxy protocol and hostname headers from the client's request. This automatically resolves localtunnel addresses (`https://*.loca.lt`) and Render domains (`https://*.onrender.com`) without manual configuration.
3. **Face Verification Constraints**:
   * Face validation relies on `face-api.js` running server-side in Node.js (via TensorFlow.js) comparing frame snapshots from the Candidate Monitor webcam stream against the reference photo. 
   * Cosine similarity descriptors are cached in-memory to prevent CPU bottlenecking.
4. **Browser Sandbox Limits**:
   * The candidate-side monitor tracks tab focus (Page Visibility API), IP address, and browser fingerprints (FingerprintJS). It operates entirely within standard browser sandbox permissions and cannot lock external software or block background desktop applications.

---

## 📋 Signal Weights Table

The **Confidence Engine** evaluates active signals within a rolling 60-second window:

| Signal Type | Weight | Rationale |
| :--- | :--- | :--- |
| **Face Verification** | 30% | Highest-weight: biometric match vs candidate reference photo. |
| **Voice Activity** | 20% | Tracked speaking duration ratio to confirm candidate active participation. |
| **Transcript Match** | 20% | Keyword occurrences addressing the candidate in diarized conversation. |
| **Email Match** | 15% | Matching participant email prefix/domain against configured candidate records. |
| **Name Match** | 10% | Fuzzy comparison of display name (Fuse.js) against candidate profile. |
| **Join Order** | 3% | Prioritizes early joiners matching candidate timelines. |
| **Camera Presence** | 2% | Confirms webcam stream is actively sending inputs. |

---

## 🛠️ Quick Start Setup Instructions

### Prerequisites
- **Node.js**: Version 18+ installed on your system.
- **MongoDB**: A running MongoDB instance (defaults to `mongodb://localhost:27017/sherlock`).
  * *Note: The server automatically falls back to an in-memory database (`mongodb-memory-server`) if it cannot connect to a local MongoDB server, enabling zero-config local runs.*

### 1. Installation
Run the installer at the monorepo root to install dependencies for both `client/` and `server/`:
```bash
npm run install:all
```

### 2. Download Face-API Models
Run the download script inside the server directory to download the biometric weights:
```bash
cd server
node scripts/download-models.js
cd ..
```

### 3. Environment Configuration
Copy the template configurations and populate appropriate keys:
```bash
# In server/ directory:
cp .env.example .env
```
Key variables inside [**`server/.env`**](file:///d:/Urvaksh%20Tirle/System/Sherlock%20Ai/server/.env):
* `RECALLAI_API_KEY`: Required for live meeting proctoring.
* `NVIDIA_API_KEY`: Required for LLM prose explanations.
* `HOST_URL`: The public forwarding address (leave blank to let the server auto-detect via request headers).

---

## 🚀 Running Locally

### Start Services Concurrently
From the root directory, run the concurrent developer servers:
```bash
npm run dev
```
* **Frontend**: `http://localhost:3000`
* **Backend**: `http://localhost:4000`

### Tunneling for Recall.ai (Local Development)
Recall.ai requires a public HTTPS endpoint to route webhook events back to your local server:
```bash
# In a new terminal:
npx localtunnel --port 4000 --subdomain sherlock-detector-candidate-98c4
```
Access the dashboard at `http://localhost:3000` and create a session.
