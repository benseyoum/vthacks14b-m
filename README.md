# SignalBridge

**Turn the signals you already use into the words you want to say.**

SignalBridge is an assistive communication prototype built at **VTHacks 14**. It watches a short sequence of nonverbal signals, infers the intended message, asks one focused clarification when the meaning is genuinely ambiguous, and speaks the resolved sentence out loud.

> **Charades is fun when it is a game. It is terrifying when it is your only way to communicate.**

### Live demo

**https://signalto.us**

---

## What problem are we solving?

Sometimes a person knows exactly what they want to communicate but cannot easily get the words out. That can happen in situations involving aphasia, ALS, autism, post-stroke recovery, intubation, or other temporary or permanent communication barriers.

Most interfaces still expect the person to adapt to the computer: type, tap through menus, or learn a rigid vocabulary.

SignalBridge explores the opposite idea:

> **People should not have to learn how to communicate with computers. Computers should learn how people already communicate.**

SignalBridge is not a medical diagnostic tool and does not claim to translate formal sign language. It interprets visible communication cues and explicitly asks when the meaning is not clear enough to state safely.

---

## Judge quick start

For the fastest way to understand the project:

1. Open **https://signalto.us** in Chrome.
2. Allow camera access.
3. Hold up a closed fist **✊** until the hands-free countdown starts.
4. Release the fist and make a short gesture sequence.
5. SignalBridge captures six frames across the interaction, checks capture quality, interprets the sequence, and speaks the message.
6. If the meaning is ambiguous, it speaks the part it already knows and asks exactly one clarification question.

### Example: clear interaction

**You → drinking gesture → point to a backpack**

SignalBridge can produce a message such as:

> “I need my water from the blue backpack.”

### Example: uncertainty handled safely

If the broad message is clear but one detail is not, SignalBridge does **not** silently guess.

For example:

> “I have chest discomfort. What type of discomfort?”

The user can choose **Sharp**, **Pressure**, or **Burning**, and SignalBridge immediately speaks the completed sentence.

There are also two **Recorded readings** on the site — **Reads clearly** and **Ambiguous** — so the two core outcomes can be demonstrated without a camera or network dependency.

---

## The core idea: negotiate meaning, do not hallucinate intent

The most important part of SignalBridge is not simply turning a gesture into text. It is deciding when the system has enough evidence to speak on someone else's behalf.

Our rule is:

- **Clear meaning → communicate it.**
- **Broad meaning clear, one detail uncertain → say what is known, then ask one question.**
- **Meaning too uncertain → do not invent a message.**

A clarification is resolved locally from the user's choice, so the completed message does not require a second model round trip.

---

## How it works

```text
Camera
  │
  ├── MediaPipe Hands → detects ✊ hands-free start
  │
  ▼
6-frame interaction sequence + motion/timing metadata
  │
  ├── Presage SmartSpectra → validates usable visual signal
  │
  ▼
Gemini on Vertex AI
  │
  ├── infers communicative intent
  ├── ranks intentionally referenced objects
  └── decides whether one clarification is needed
  │
  ▼
Clarification UI (only when necessary)
  │
  ▼
ElevenLabs → speaks the final first-person message
```

### Why a sequence instead of a snapshot?

SignalBridge captures **six frames over roughly 3.5 seconds** and sends timestamp + measured motion information with each frame. That lets the model compare rest positions with high-motion moments and reason about the interaction as a sequence rather than treating six similar still images equally.

---

## Sponsor / technology integrations

### Google Gemini + Vertex AI

Gemini is the semantic reasoning layer. It receives the short frame sequence and structured motion metadata, then returns a constrained JSON interpretation containing:

- actor
- intent
- semantic action
- ranked object candidates
- supporting context
- whether clarification is required
- one clarification question and 2–3 options when needed
- the safest first-person sentence to speak

The model is explicitly instructed not to diagnose medical conditions, infer sensitive traits, or treat incidental background objects as intentional references.

### ElevenLabs

Resolved messages are sent through the ElevenLabs text-to-speech API and played in the browser. During an ambiguous interaction, SignalBridge first speaks the meaning already established, asks the clarification question, and then speaks the completed sentence after the user's choice.

### Presage SmartSpectra

Presage is used as a **visual-signal validation layer** before interpretation. Captured RGBA frames are passed through the SmartSpectra Node SDK, and recent validation samples are summarized so the UI can tell whether the camera signal is usable or needs adjustment.

Presage is not used to infer the person's intent or diagnose a condition.

### Vultr

The production app runs on an Ubuntu Vultr instance behind Nginx and HTTPS. The public deployment is available at:

**https://signalto.us**

### GoDaddy Registry

The project uses the hackathon domain:

**signalto.us** — read naturally as **“signal to us.”**

### Tiger Data

The repository also contains a dedicated Tiger Data integration branch:

**[`db/tiger-data`](https://github.com/benseyoum/vthacks14b-m/tree/db/tiger-data)**

That branch adds an event-storage lane for **confirmed communication readings** using Tiger Cloud / Postgres hypertables and a real-time rollup. The database path is deliberately failure-tolerant: communication should still work even if the database is unavailable.

It stores confirmed message metadata and evidence — **not camera frames**. The Databricks federation experiment and its current status are documented in that branch as well.

---

## Privacy and safety choices

SignalBridge is designed around a simple principle: **putting incorrect words in someone's mouth is a serious failure mode.**

A few deliberate constraints:

- Captured camera frames are sent for live interpretation and are not persisted by the SignalBridge application.
- The prompt avoids appearance-based identification such as race, gender, clothing, age, or hair.
- Incidental objects in the room are ignored unless the user intentionally references them.
- SignalBridge does not diagnose medical conditions.
- SignalBridge does not claim to be an ASL or formal sign-language translator.
- Confidence scores are ranking signals, not medical or statistical certainty.

---

## Features

- ✊ **Hands-free start** using MediaPipe hand landmarks
- **3-2-1 capture countdown** so the user can move from the trigger gesture into their actual message
- **Temporal interpretation** from six ordered camera frames
- **Motion-aware reasoning** using measured frame-to-frame change
- **Presage capture-quality verification**
- **Structured Gemini output** with a strict interpretation schema
- **Single-question clarification flow** for meaningful ambiguity
- **Partial speech during clarification** instead of silencing what is already known
- **ElevenLabs voice output**
- **Conversation transcript** for resolved messages
- **Offline recorded demos** for clear and ambiguous outcomes
- **Production deployment** at `signalto.us`

---

## Tech stack

- **Next.js 16** / App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Google Gen AI SDK / Gemini on Vertex AI**
- **ElevenLabs API**
- **Presage SmartSpectra Node SDK**
- **MediaPipe Hands**
- **Vultr**
- **Nginx + Let's Encrypt**
- **GoDaddy Registry / signalto.us**
- **Tiger Data** on the database integration branch

---

## Run locally

### 1. Clone and install

```bash
git clone https://github.com/benseyoum/vthacks14b-m.git
cd vthacks14b-m
npm install
```

### 2. Configure environment variables

Create `.env.local` with the services you want to enable:

```env
GOOGLE_CLOUD_PROJECT=your-google-cloud-project-id
GOOGLE_CLOUD_LOCATION=global

ELEVENLABS_API_KEY=your-elevenlabs-api-key
# Optional overrides:
# ELEVENLABS_VOICE_ID=...
# ELEVENLABS_MODEL_ID=...

SMARTSPECTRA_API_KEY=your-presage-smartspectra-api-key
```

Vertex AI also requires normal Google Application Default Credentials in your environment. Do **not** commit credentials or `.env.local`.

### 3. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**.

### Production build

```bash
npm run build
npm start
```

---

## Repository map

```text
app/
  api/
    interpret/       Gemini interpretation endpoint
    presage/         Presage SmartSpectra validation endpoint
    speech/          ElevenLabs speech endpoint
  page.tsx           Main SignalBridge experience

components/
  CameraCapture.tsx  Camera, countdown, frame capture, hands-free trigger
  CaptionOverlay.tsx Spoken/clarification UI
  IntentPanel.tsx    Interpretation evidence
  Transcript.tsx     Resolved communication history

lib/
  gemini.ts          Intent-understanding prompt + structured Gemini call
  fistGesture.ts     MediaPipe closed-fist trigger
  demo.ts            Offline clear/ambiguous recorded examples
  intent.ts          Local clarification resolution
  useSpeech.ts       ElevenLabs/Web Audio playback
```

---

## What we built at VTHacks 14

SignalBridge was created as a two-person VTHacks 14 project. The hack combines real-time browser camera capture, gesture-triggered interaction, multimodal AI interpretation, uncertainty-aware UX, visual-signal validation, generated speech, cloud deployment, and a time-series persistence experiment.

External platforms and open-source libraries are used as infrastructure and building blocks; the SignalBridge interaction flow, temporal capture logic, uncertainty policy, clarification UX, hands-free trigger, prompt/schema design, and product experience were assembled for the hackathon.

---

## Project philosophy

**SEE → VERIFY → INFER → CLARIFY → SPEAK**

SignalBridge is an experiment in building interfaces that adapt to how people already communicate — while being explicit about what the system does and does not know.

**Don't hallucinate intent. Negotiate meaning.**
