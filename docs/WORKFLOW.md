# OneAlert Workflows & Operations: Comprehensive Execution Guide

This document details the exact, step-by-step lifecycles, edge-case handling, data transformations, and error-recovery mechanisms of the various features within the OneAlert platform. It moves from user interaction down to backend processing, external API routing, and data persistence.

---

## 1. Physical SOS & Emergency Workflow

The core functionality of OneAlert is its ability to rapidly trigger and broadcast an emergency SOS under extreme stress conditions, prioritizing speed and absolute resilience over local networks.

### Step 1: The Trigger Phase & Silent Escalation
A citizen in distress can activate the SOS via multiple redundant methods to ensure activation even if the phone is concealed:
- **Physical Interaction**: Tapping the massive, red SOS button on the home screen. The UI immediately disables the button to prevent duplicate `POST` requests and triggers a local haptic feedback motor via Capacitor.
- **Hardware Button Mapping**: Pressing the hardware volume-down button rapidly 3 times (captured via native Capacitor intent listeners).
- **Voice Activation (Silent SOS)**: Utilizing the hidden `VoiceContext` listener, users can utter a predetermined safe-word (e.g., "Help Help Help"). 
  - *Audio Buffering*: The microphone processes the audio locally via `webkitSpeechRecognition`. If the screen is locked, Android Background Services keep the audio buffer active. It operates purely on-device to prevent latency, ensuring the trigger works completely hands-free.

### Step 2: Local Device Processing & Background SMS Failsafe
Immediately upon recognizing a trigger:
1. **Telemetry Initialization**: The app invokes `LocationTracker.js` using `navigator.geolocation.watchPosition` with high accuracy settings. It requests continuous background execution permission to ensure the OS does not kill the thread.
2. **Security Generation**: A random **6-digit Privacy PIN** is auto-generated cryptographically using `window.crypto.getRandomValues()` (scaled to 6 digits) and saved to `localStorage`.
3. **Payload Construction**: The frontend constructs an emergency SMS payload containing the exact `[lat, lng]`, the incident ISO timestamp, and the Privacy PIN.
4. **Native SMS Dispatch**: To bypass local Wi-Fi or 4G data connectivity issues, the app uses a custom Java `SMSPlugin` to send the message in the background directly through the cellular GSM modem to pre-registered emergency contacts. The Android OS default messaging UI is entirely bypassed to save crucial seconds. If the message length exceeds 160 characters, it utilizes `sendMultipartTextMessage`.

### Step 3: Backend Propagation & Analytics
The frontend fires a `POST /api/incident` request to the backend with payload type `"physical_sos"`.
1. **Reverse Geocoding**: The backend automatically reverse-geocodes the coordinates via an async worker to attach a human-readable street address without blocking the main thread.
2. **Threat Computation**: The `threat_score` engine evaluates velocity (delta between pings), time of day, and historical crime data. If the user's velocity exceeds typical walking speeds while an SOS is active, the system automatically escalates the threat to a "Kidnapping/Abduction Risk" flag.
3. **Persistence**: The incident is persisted to the MongoDB `incidents` collection.
4. **Network Redundancy (Race Condition Handling)**: If the native SMS failed (or the user is on a web browser), the backend triggers a Twilio API background task to send the SMS over the network.

### Step 4: Live Telemetry & Tracking
1. **Broadcasting**: The backend executes `manager.broadcast_incident()`, serializing the incident payload into a WebSocket frame and dispatching it to all authenticated Police Dashboards.
2. **Police Alerting**: The police React UI flashes red, plays an audible alert, and instantly drops a pulsating Leaflet pin on the live tracking map.
3. **Continuous Pinging**: As the citizen moves, the frontend continues to push updated coordinates to the WebSocket every 5 seconds. This populates the `location_history` array, allowing the police to track the victim's exact path and predict their trajectory in real-time.

---

## 2. Cyber Crime Reporting & Chain of Custody Workflow

This workflow handles non-immediate threats such as cyberstalking, financial fraud, and identity theft, emphasizing rigorous legal admissibility and chain of custody.

### Step 1: Guided Report Generation
1. The user navigates to the Cyber Crime form and selects a precise category (e.g., "Financial Fraud", "Deepfake Misuse").
2. The UI adapts dynamically based on the selection, rendering specific schema fields (e.g., requesting UPI transaction IDs for fraud, or suspect social media handles for stalking).
3. The user types a narrative description of the events.

### Step 2: Automated Evidence Hashing & Legal Custody
1. The user selects evidence files (chat screenshots, audio recordings, PDF bank statements).
2. **Client-Side Hashing**: Before upload, the frontend uses the Web Crypto API to generate a strict `SHA-256` hash of the raw file bytes.
3. **Transmission**: The frontend constructs a `multipart/form-data` payload and transmits it to `POST /api/upload`.
4. **Server Validation & Hash Check**: The backend saves the chunked files to disk, generating a unique `file_path`. It recalculates the SHA-256 hash server-side. If the server hash does not match the client hash, the upload is rejected to prevent packet corruption or man-in-the-middle tampering.
5. **Encryption**: If marked `is_sensitive`, the backend encrypts them instantly using AES-256 Fernet symmetric encryption. The hash and encryption status are saved as immutable metadata in the DB.

### Step 3: AI-Assisted FIR Drafting & State Handoff
1. The incident is saved to the database as a `"cyber_report"`.
2. A background asynchronous task fires, calling the OpenRouter LLM API.
3. **LLM Execution**: The LLM digests the user's unstructured narrative and automatically drafts a structured, legal First Information Report (FIR), formatted according to jurisdictional legal standards.
4. **State-Level Sync**: The backend serializes the data and attempts to sync this incident with the mock state-level Cyber Crime Branch (CCB) API via an HTTP POST, receiving a unique `ccb_case_ref` tracking number.

### Step 4: Privacy, Data Protection & Demo Architecture Scope
Because the system deals with highly sensitive, personally identifiable information (PII), strict data protection protocols are designed into the workflow.

1. **LLM PII Redaction & Mocking**
   - **Current Prototype State**: To comply with data privacy standards, raw victim statements containing real names or phone numbers are *not* transmitted to public AI models unredacted. The AI FIR drafting mechanism currently uses synthetic data during live demonstrations to ensure zero risk of PII leakage.
   - **Production Roadmap**: In a fully deployed environment, the system will utilize an air-gapped, on-premise LLM (e.g., a locally hosted Llama-3 instance on police servers).

2. **Cyber Crime Branch (CCB) API Simulation**
   - **Current Prototype State**: The sync endpoint routes to a mock, closed-loop server to prove the concept without interfacing with classified police infrastructure.
   - **Production Roadmap**: Production deployment will replace this mock endpoint with a mutual TLS (mTLS) authenticated connection over a secure governmental VPN tunnel.

### Step 5: Police Review & Document Export
1. The report appears in the Police Dashboard under the "Cyber" tab.
2. The investigating officer clicks the report to view the AI-drafted FIR, suspect details, and the evidence timeline.
3. **Documentation Export**: The officer clicks "Download PDF". The frontend leverages `jsPDF` to generate a complete, legally formatted PDF containing the FIR, the chain-of-custody hashes for all evidence, and the user's demographic data, ready for immediate court submission.

---

## 3. Evidence Decryption & Access Control Workflow

To maintain a strict chain of custody and protect victim privacy, sensitive evidence is encrypted at rest. Access is strictly compartmentalized based on authorization.

### Citizen Access (Manual Key Entry)
1. When a citizen attempts to view an encrypted file from their incident timeline, they are prompted by the UI to enter the Privacy PIN.
2. The frontend sends the PIN along with the file path to `POST /api/evidence/decrypt`.
3. The backend uses `PBKDF2HMAC` to reconstruct the AES-256 decryption key using the provided PIN and a static server salt. 
4. **In-Memory Decryption**: The backend decrypts the file bytes purely in-memory. The raw file stream is sent back to the frontend via a standard HTTP `Blob` response. The unencrypted file never touches the server's hard drive, mitigating forensic recovery risks.

### Police Access (Automated Seamless Decryption)
1. When a logged-in police officer clicks on the evidence, the system bypasses the manual password prompt entirely.
2. **Key Retrieval**: The frontend securely retrieves the `decryption_key` (which was generated during incident creation and is temporarily attached to the active session incident payload sent to the authenticated officer).
3. **Execution**: The file path and key are sent to `/api/evidence/decrypt`. The file is seamlessly decrypted by the backend and displayed to the officer, ensuring law enforcement has zero-friction access while still maintaining robust disk-level encryption.

---

## 4. AI Threat Scanner Workflow

A proactive, low-latency tool to prevent cybercrimes before they happen.

1. **Input**: A user pastes a suspicious SMS message or a hyperlink into the Threat Scanner UI.
2. **Transmission**: The frontend sends the payload to `POST /api/scan-threat`.
3. **Level 1 Filter (Regex Heuristics)**: The backend first checks its internal database cache and matches against a Regex array of known phishing keywords (e.g., `(?:urgent|update KYC|bit\.ly|login|prize)`). If a strict match is found, it bypasses the LLM to save compute resources.
4. **Level 2 Filter (LLM Analysis)**: If the heuristics are inconclusive, it forwards the payload to the OpenRouter LLM. The prompt demands a JSON response containing a `threat_score` (0-100), an array of specific `flags`, and actionable `recommendations`.
5. **Output**: The JSON result is parsed, validated against a Pydantic schema, and cached in MongoDB. The UI instantly updates, displaying an animated Threat Level gauge to the user.

---

## 5. Dynamic Unsafe Zones & Predictive Modeling Workflow

1. **Aggregation Pipeline**: The backend exposes an `/api/unsafe-zones` endpoint. It executes a MongoDB aggregation pipeline on all historical incidents where `type == "physical_sos"`.
2. **Spatial Clustering Algorithm**: A compute worker iterates over the coordinate arrays, grouping incidents that occur within a 2-kilometer radius using the Haversine formula for spherical distance computation.
3. **Classification Rule**: If a cluster contains 3 or more incidents within a rolling 30-day window, it is mathematically classified as a High-Risk "Unsafe Zone".
4. **Map Visualization**: The frontend fetches this JSON array and uses Leaflet geometry to render pulsing red boundary polygons (heatmaps) on the user's interface.
5. **Proactive Alerts**: A local geofencing worker runs in the Capacitor background. If the user's GPS trajectory intersects with one of these polygons, the app issues a local Native Push Notification warning them of historical danger in the immediate area.
