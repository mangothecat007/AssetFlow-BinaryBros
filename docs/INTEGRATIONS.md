# External Integrations & Services: Deep Dive

OneAlert relies on a carefully selected stack of third-party APIs and native integrations to provide cutting-edge AI capabilities and failsafe communication channels. This document details the exact payloads, prompts, and failure handling mechanisms for each integration.

---

## 1. [PROPOSED IDEA] OpenRouter (LLM AI Engine)

We utilize the **OpenRouter API** to route prompts to advanced Large Language Models (LLMs) like `gpt-4o-mini`, providing intelligent processing for raw user input without the heavy computational overhead of running local AI models on constrained mobile devices.

### Integration Points

#### A. Automated FIR Drafting

- **Trigger**: Fired asynchronously when a citizen submits a "Cyber Report" incident.
- **Payload Structure**: The backend aggregates the incident type, the user's narrative description, timestamp, and metadata into a prompt string.
- **System Prompt**:
  > _"You are an AI assistant helping a police officer draft a formal First Information Report (FIR) based on the following victim statement. You MUST extract: Date/Time of Incident, Suspect Details (if any), Victim Details, and a chronologically structured narrative. Maintain a neutral, legal tone. Do not invent facts."_
- **Execution**: The request is fired using `aiohttp` to ensure the main FastAPI event loop is not blocked.
- **Result Handling**: The output text is saved directly to the `ai_analysis.draft_fir` field in the MongoDB database, significantly reducing the bureaucratic burden on police officers.

#### B. Threat Scanner Module

- **Trigger**: Fired when a user inputs a suspicious URL or SMS message into the Threat Scanner UI.
- **System Prompt**:
  > _"You are a cybersecurity expert analyzing a potential phishing attempt or scam message. You must reply strictly with a JSON object matching this schema: `{"score": number (0-100), "flags": string[], "recommendations": string[], "is_malicious": boolean}`. Do not output markdown, only valid JSON."_
- **Error Handling**: If the LLM hallucinates and returns invalid JSON, the backend catches the `JSONDecodeError`, logs the failure, and returns a safe fallback response (e.g., "Analysis failed, proceed with extreme caution") to prevent UI crashes.

---

## 2. [PROPOSED IDEA] Twilio (Background Network SMS)

For situations where the native mobile application cannot send an SMS (e.g., the user is accessing the platform via a web browser on a laptop, or lacks specific Android SMS permissions), Twilio acts as the network-based failsafe.
Currently, Twilio is not integrated into the application, since Twilio requires the phone number to be registered an authenticated to start the SMS but it is planned to be integrated in the future.
Instead of Twilio, the application uses the native Android SMS plugin to send SMS for now.

### Technical Configuration

- **Authentication**: Relies on three environment variables loaded via `dotenv`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.
- **Mock Fallback**: If these environment variables are missing (e.g., during local development), the backend falls back to a terminal print simulation, ensuring the app does not crash when executing the emergency workflow.

### Dispatch Execution

- An asynchronous background task (`send_background_sms`) is spawned upon SOS creation.
- It iterates through the victim's array of trusted emergency contacts.
- **Payload Optimization**: It constructs a concise SMS containing: `Location Coordinates`, `Report Tracking ID`, and the `Decryption Privacy PIN`.
- **Error Handling**: Each `client.messages.create` call is wrapped in a `try/except` block. If a specific contact's phone number is malformed, it catches the `TwilioRestException`, logs the failure, and continues to the next contact without halting the loop.

---

## 3. Native Android Cordova SMS (Via Capacitor)

To guarantee that an SOS message goes out even if the user has a poor cellular data connection but maintains basic GSM cell service, OneAlert implements a custom native integration deeply tied to the Android OS.

### The Problem with Standard Web APIs

Standard HTML5/Web Share APIs or `sms://` URI schemes require the user to explicitly open their default SMS app (like Google Messages) and press "Send." In a life-threatening emergency, this multi-step, visually demanding process is completely unacceptable.

### The Solution: Custom `SMSPlugin.java`

- We embedded a customized **Cordova SMS Plugin** into our Capacitor Android build, modifying the underlying Java code.
- **Background Execution**: The plugin interacts directly with the Android `SmsManager` class (specifically `SmsManager.getDefault()`) to dispatch the message completely silently in the background.
- **Multipart Support**: Emergency URLs containing full exact latitude/longitude strings and metadata can exceed the 160-character limit of a single SMS. The plugin explicitly uses `sendMultipartTextMessage` instead of `sendTextMessage`. This ensures the full alert is delivered intact without fragmentation or out-of-order delivery.
- **Permissions Handling**: The plugin aggressively checks for `Manifest.permission.SEND_SMS`. If missing, it requests it. On modern Android versions (API 30+), it also handles `FLAG_IMMUTABLE` constraints on `PendingIntent` broadcasts to prevent runtime crashes.

---

## 4. Cyber Crime Branch (CCB) API Simulation

To demonstrate how OneAlert fits into existing state infrastructure, we built a mock integration layer mimicking a national or state-level police database (e.g., the NCRP - National Cyber Crime Reporting Portal).

### Synchronization Workflow

- Upon creation of a `cyber_report` incident, the backend triggers `forward_to_ccb()`.
- The system serializes the incident data into a rigid JSON schema required by the mock CCB API.
- It sends an HTTP POST request to a simulated endpoint (`http://10.160.227.68:8082/api/incident`).
- **Idempotency**: It expects a `200 OK` response containing a `case_ref` (State Tracking Number).
- **Persistence**: If successful, the local database updates the incident's `ccb_sync_status` to `"synced"` and saves the `ccb_case_ref`. This proves that the incident has been formally escalated beyond the local jurisdiction and prevents duplicate filings.

---

## 5. Google Maps API (`@react-google-maps/api`)

To provide absolute precision for law enforcement dispatch, the Police Dashboard relies heavily on the Google Maps Platform rather than generic open-source map tiles.

### Core Utilizations

- **Reverse Geocoding**: Translates raw GPS coordinate strings into human-readable street addresses and jurisdiction boundaries so that the nearest police cruiser can be dispatched intelligently.
- **Unsafe Zones Visualization**: Renders complex polygonal boundary arrays (from the backend clustering algorithms) over the map to visually highlight dangerous sectors. Google Maps View exists, however: CURRENTLY DISABLED DUE TO PAID GOOGLE MAPS API KEY.

---
