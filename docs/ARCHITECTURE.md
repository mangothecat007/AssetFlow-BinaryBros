# OneAlert System Architecture: Comprehensive Technical Design Document

OneAlert is built as a robust, real-time, and privacy-first **Unified Cyber-Physical Safety Platform**. It seamlessly integrates high-speed emergency response mechanisms with secure cybercrime reporting features, leveraging modern web and native technologies. This document provides an exhaustive, low-level architectural view of the entire stack, suitable for engineering handoffs and security audits.

---

## 1. Architecture & Core Philosophies

The system operates on a highly decoupled microservice-inspired monolithic client-server model. It is designed to prioritize low-latency emergency alerts, background execution resilience, and military-grade encryption for sensitive data.

### Core Architectural Patterns:

- **Resilience-First & Offline-First Design**: The application assumes volatile network conditions. It operates even during partial network failures via Local Database Fallbacks and Native SMS cellular pathways.
- **Event-Driven Telemetry**: Uses an asynchronous WebSockets implementation to stream live location coordinates continuously from victims to police authorities without HTTP polling overhead.
- **Zero-Knowledge Encryption Principles**: Evidence files are heavily encrypted at rest, and emergency reports are protected via auto-generated PINs. The server retains only hashed versions of keys in the database.
- **AI-Augmented Processing**: Integrates Large Language Models (LLMs) as micro-services for proactive threat scanning and automated First Information Report (FIR) drafting.

---

## 2. Directory Structure & Code Organization

The repository is logically divided into distinct, decoupled domains:

```text
OneAlert/
├── app/
│   ├── backend/                 # Python FastAPI Server
│   │   ├── main.py              # Application entry point
│   │   ├── server.py            # Core routing, WebSocket Manager, and business logic
│   │   ├── db.py                # Database interface (MongoDB & Local JSON Fallback)
│   │   ├── models/              # Pydantic schemas for strict validation
│   │   └── .env                 # Backend config
│   └── frontend/                # React.js PWA & Capacitor Native Wrapper
│       ├── android/             # Auto-generated Native Android source code
│       ├── src/
│       │   ├── components/      # Reusable UI components (shadcn/ui inspired)
│       │   ├── context/         # React Contexts (AuthContext, VoiceContext)
│       │   ├── hooks/           # Custom React hooks (useVoiceCommand, useMicPermission)
│       │   ├── lib/             # Utility functions, API configs, Firebase init
│       │   ├── pages/           # Top-level route components (Dashboard, Citizen, Login)
│       │   └── utils/           # LocationTracker, commandParser
│       ├── tailwind.config.js   # UI Design System tokens
│       └── capacitor.config.js  # Native bridge configuration
└── docs/                        # Technical Documentation
```

---

## 3. Frontend Layer (Client Application)

The frontend is a progressive web application (PWA) compiled into a native mobile wrapper. It acts as the primary sensory input for the system (GPS, Mic).

### Technical Stack

- **UI Framework**: React.js 18 (Hooks-based architecture).
- **Build Tool**: Vite (chosen over Webpack for Hot Module Replacement speed and smaller bundle sizes).
- **Styling Engine**: Tailwind CSS. We utilize custom CSS variables for programmatic dynamic theming (Dark/Light mode support), ensuring UI accessibility standards are met under high-stress conditions.
- **Native Bridge**: Capacitor. Capacitor injects an Android WebView but bridges JavaScript calls directly to Native Java/Kotlin APIs.
- **Routing**: `react-router-dom` v6 for SPA navigation, implementing protected routes via an `<AuthGuard>` HOC.

### State & Context Management

The application completely avoids heavy, boilerplate-heavy state managers like Redux to maintain a minimal memory footprint. We rely exclusively on optimized React Contexts:

1. **`AuthContext`**: Manages the JSON Web Token (JWT) lifecycle. It intercepts all outgoing API requests to append Bearer tokens and distinguishes between `Citizen` (unauthenticated emergency access) and `Police` (authenticated authority access).
2. **`VoiceContext`**: Maintains a continuous, persistent `webkitSpeechRecognition` listener. It acts as an invisible background daemon listening for specific frequency patterns or safe-words (e.g., "Help Help Help").

### Hardware Utilization via Capacitor Plugins

The web layer requests hardware-level execution through Capacitor plugins, escaping the browser sandbox:

- **`Geolocation API`**: Hooked deeply into the device's GPS hardware chip, forcing `enableHighAccuracy: true` and bypassing cell-tower triangulation when possible for sub-meter accuracy.
- **`Microphone/Audio`**: Uses the `navigator.mediaDevices.getUserMedia` API for capturing ambient audio as digital evidence, processing it through an `AudioContext` script processor for volume thresholds.
- **`Native SMS Modem`**: Leverages a custom Java plugin (`SMSPlugin.java`) to directly interface with the Android `SmsManager` class, allowing background SMS dispatch without user intervention.

---

## 4. Backend Layer (Server API)

The backend is a high-performance, async-first RESTful API and WebSocket server built in Python, engineered for massive concurrency during emergency spikes.

### Technical Stack

- **Core Framework**: FastAPI (chosen for its native asynchronous capabilities, Pydantic data validation, and high throughput).
- **ASGI Server**: Uvicorn.
- **Concurrency Model**: Python `asyncio` for non-blocking I/O. By utilizing `await` on database calls and HTTP requests, a single thread can handle thousands of concurrent WebSocket connections.

### Key Micro-Services & Routers

1. **Incident Manager (`/api/incident`)**
   - Ingests physical SOS and cyber reports via strictly typed Pydantic models.
   - Utilizes a custom **Threat Engine** (`calculate_threat_score`) which evaluates variables like time of day, movement velocity (derived from GPS deltas), and keyword density to assign a numerical threat value (0-100).
2. **Live Telemetry Engine (`/ws/{client_id}`)**
   - The `ConnectionManager` class maintains a global state dictionary of active WebSocket connections.
   - When a citizen pings a location update, the server identifies all authenticated Police Dashboard clients and `broadcasts` the JSON payload to them instantly.
3. **Evidence Vault (`/api/upload` & `/api/evidence/decrypt`)**
   - Manages chunked file uploads (`UploadFile` in FastAPI) to prevent memory overflow on large video files.
   - Applies **AES-256 encryption** using the `cryptography.fernet` library to any file flagged as `is_sensitive` before executing a disk write (`aiofiles`).
4. **AI Gateway (Background Tasks)**
   - Interfaces asynchronously with OpenRouter LLMs. It parses raw AI text streams into structured JSON via strict prompt engineering.

---

## 5. Data Storage & Resilience Layer

Data integrity and availability are critical. OneAlert utilizes a dual-database approach to ensure zero data loss during cloud outages.

### Primary Database: MongoDB

- **Driver**: `motor` (Asynchronous Python driver for MongoDB). This prevents blocking the FastAPI event loop during heavy read/write operations.
- **Collections Schema**:
  - `incidents`: The core collection. Stores comprehensive incident reports, evidence metadata (including AES salts and hashes), chain-of-custody checksums, and massive nested arrays of location history coordinates.
    ```json
    {
      "_id": "ObjectId",
      "incident_id": "string (e.g., INC-12345)",
      "type": "physical_sos | cyber_report",
      "status": "active | resolved | closed",
      "threat_score": "integer (0-100)",
      "privacy_pin_hash": "string (SHA-256)",
      "location_history": [
        { "lat": "float", "lng": "float", "timestamp": "ISO-8601" }
      ],
      "evidence": [
        {
          "file_path": "string",
          "is_sensitive": "boolean",
          "sha256_hash": "string",
          "uploaded_at": "ISO-8601"
        }
      ],
      "ai_analysis": {
        "draft_fir": "string",
        "flags": ["string"]
      },
      "ccb_sync_status": "pending | synced",
      "created_at": "ISO-8601 Timestamp"
    }
    ```

> [!NOTE]
> **User Management**: In the current demonstration prototype, there is no physical `users` collection. User authentication for police officers is handled via an in-memory hardcoded dictionary (`auth.py`) for simplicity during demos. Production scaling will require implementing a dedicated `users` collection for RBAC and identity management.


### Fallback Database: Local JSON Store

- **Graceful Degradation Protocol**: In `db.py`, every database operation is wrapped in a robust try/except block. If a `ServerSelectionTimeoutError` occurs (indicating MongoDB is down, rate-limited, or unreachable), the driver dynamically swaps the connection pointer to a local filesystem JSON file (`local_db.json`).
- This offline-first methodology guarantees that incoming SOS alerts and critical evidence are captured even if the cloud infrastructure is under a DDoS attack or experiencing a catastrophic outage.

---

## 6. Security & Privacy Architecture

Security is baked into every layer to protect victims from retaliatory actions, data breaches, and unauthorized surveillance.

1. **Authentication & Authorization**
   - **JWT (JSON Web Tokens)**: Used to secure API endpoints with short expirations.
   - **Role-Based Access Control (RBAC)**: The frontend completely isolates the Citizen views from the Police Dashboard. Backend routes explicitly check the `role` claim in the JWT before returning classified data.
2. **Encryption At Rest (Zero-Knowledge)**
   - **AES-256 File Encryption**: When a user uploads evidence, the backend derives a 32-byte symmetric key using `PBKDF2HMAC` (100,000 iterations, SHA256) based on the incident's auto-generated Privacy PIN and a static server salt.
   - **Disk Security**: Even if a malicious actor gains root access to the server filesystem, the evidence files (`.jpg`, `.mp4`) remain cryptographically unreadable without the specific 6-digit incident PIN stored only on the victim's device or in SMS logs.
3. **Emergency Privacy PINs**
   - When an SOS is triggered, the citizen does not have time to invent a password. The system auto-generates a highly entropic 6-digit Privacy PIN using `Math.random()` scaled by timestamp seeds.
   - This PIN is embedded ONLY in the background SMS sent to trusted contacts, ensuring only authorized individuals receive the decryption keys.
4. **Data Hashing & Chain of Custody**
   - Passwords and PINs are hashed using SHA-256 before database insertion.
   - Uploaded evidence generates a `SHA-256 checksum` at the exact moment of upload. This hash is embedded into the generated FIR, ensuring legal admissibility in court by proving the file was not tampered with post-upload.

---

## 7. Real-Time Telemetry Implementation

The real-time architecture is the backbone of the emergency response, achieving sub-second latency updates:

1. **Client Acquisition**: Citizen device activates `LocationTracker.js` using the HTML5 Geolocation API (`enableHighAccuracy: true`).
2. **Payload Construction**: The client constructs a minified JSON object: `{"id": "INC-123", "lat": 23.02, "lng": 72.57, "v": 15, "acc": 4, "ts": 1718000000}`.
3. **Transmission**: Sent via `wss://` (Secure WebSockets) over a persistent TCP connection to the FastAPI server.
4. **Routing**: The FastAPI `ConnectionManager` filters active connections, dropping stale or inactive ones via ping/pong frames, and routes the payload to authenticated police clients.
5. **UI Rendering**: The Police Dashboard React state updates instantly. The Map component (Leaflet/Google Maps wrapper) re-renders the marker using hardware-accelerated CSS transitions for smooth visual movement, completely eliminating page refresh lag and visual stutter.

---

## 8. Scalability & Deployment Strategy

To handle sudden spikes in emergency reports during major civil events, the architecture is designed to scale horizontally:

- **Stateless Backend**: The FastAPI backend holds no session state. JWTs manage auth, and WebSockets can be scaled using a Redis Pub/Sub backplane.
- **Containerization**: Both the frontend build and backend server are container-ready (Docker), allowing orchestration via Kubernetes for auto-scaling under load.
- **CDN Caching**: Static frontend assets (Vite build output) are deployed to Edge Networks (e.g., Vercel, Cloudflare) for instantaneous load times regardless of the user's geographical location.
