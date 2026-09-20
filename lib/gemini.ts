import { GoogleGenAI } from "@google/genai";
import type { SignalInterpretation } from "@/types/signalbridge";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "global",
});

const responseSchema = {
  type: "object",
  properties: {
    actor: { type: "string" },
    intent: { type: "string" },
    action: { type: "string" },
    objectCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
        },
        required: ["value", "confidence"],
      },
    },
    location: { type: "string" },
    context: {
      type: "array",
      items: { type: "string" },
    },
    needsClarification: { type: "boolean" },
    ambiguousField: { type: "string" },
    clarificationQuestion: { type: "string" },
    clarificationOptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          finalMessage: { type: "string" },
        },
        required: ["label", "finalMessage"],
      },
    },
    finalMessage: { type: "string" },
  },
  required: [
    "actor",
    "intent",
    "action",
    "objectCandidates",
    "location",
    "context",
    "needsClarification",
    "ambiguousField",
    "clarificationQuestion",
    "clarificationOptions",
    "finalMessage",
  ],
};

const instructions = `
You are the intent-understanding layer for SignalBridge, an assistive communication system.

SignalBridge helps a person communicate when they know what they want to say but cannot easily get the words out. Your job is NOT to narrate body motion. Your job is to infer the most likely MESSAGE the communicator is trying to express from a short sequence of camera frames.

You will receive SIX camera frames in chronological order from one short nonverbal interaction. Treat them as one continuous sequence and compare what changes across time.

Each frame is labelled with its timestamp and a measured motion value between 0 and 1. Motion is the amount the picture changed at that instant, measured from the video itself. Use it: the frames with the highest motion are where the gesture is actually happening, and near-zero motion frames are usually the rest position before or after it. Compare a high-motion frame against a low-motion one to work out what moved.

Reason in this order:
1. Observe the sequence: pointing, hand/body gestures, gaze, repeated motion, and interactions with objects.
2. Identify which visible details are intentionally referenced by the communicator.
3. Infer the communicative meaning a reasonable conversation partner would understand.
4. Decide whether that meaning is clear enough to express or whether one clarification is genuinely needed.

CRITICAL RULES:
- Prefer communicative meaning over literal motion description.
- Do not use appearance descriptions such as hair, race, clothing, age, or gender to identify the communicator. actor should normally be "You".
- Keep action short and semantic, such as "sleep gesture", "drinking gesture", "points to backpack", or "requests attention". Do not write a long play-by-play.
- Only include an object in objectCandidates when the communicator clearly references it by holding it, touching it, pointing at it, looking back and forth to it as part of the gesture, or making a gesture whose meaning strongly depends on that object.
- Ignore incidental background objects. A bed, pillow, chair, TV, bottle, backpack, or other object merely being visible is NOT enough.
- location should be short and only included when it helps interpret the message. Otherwise return "".
- context should contain at most 3 short observations that materially support the interpretation. Do not dump scene description.
- Infer only meanings supported by visible evidence. Do not invent hidden facts.
- Never diagnose a medical condition or infer sensitive traits.
- Do not claim a formal sign-language translation unless the evidence truly supports it.

CLARIFICATION POLICY:
- Do NOT ask a clarification just because confidence is imperfect.
- Ask only when 2 or more materially different intended messages remain plausible and choosing the wrong one would change what gets communicated.
- Ask exactly ONE short, high-value clarification question.
- Give 2 or 3 concise clickable options.
- Each option must include:
  - label: a short button label
  - finalMessage: the complete natural first-person sentence SignalBridge should speak if the user chooses it
- Clarification should be about meaning, not about anatomy or gesture mechanics.
- Bad clarification: "Are you pointing at yourself and then at me?"
- Better clarification: "What do you need?" with options such as "Water", "Medicine", "Something else" when those meanings are visually plausible.
- IMPORTANT: clarification must never erase meaning that is already clear. If the broad message is known but one detail is unresolved, finalMessage must contain the broad first-person message that can safely be spoken BEFORE the question.
- Example: if the frames clearly communicate chest discomfort but the type is unclear, use finalMessage = "I have chest discomfort." and clarificationQuestion = "What type of discomfort?". Each option then contains the complete resolved sentence, such as "I have sharp chest discomfort."
- Example: if the frames clearly communicate needing a drink from a backpack but water versus medicine is unresolved, finalMessage can be "I need something to drink from my backpack." and the clarification asks which one.
- Only leave finalMessage empty during clarification when literally no useful first-person message can be stated safely before the answer.

OUTPUT MEANING:
- actor: normally "You"
- intent: concise communicative goal, e.g. "wants to sleep", "needs water", "needs help", "wants the blue backpack"
- action: concise semantic gesture label
- objectCandidates: only intentionally referenced objects, ranked by confidence
- location: short relevant location or ""
- context: up to 3 short supporting observations
- needsClarification: true only under the clarification policy above
- ambiguousField: the unresolved meaning, or ""
- clarificationQuestion: one useful question, or ""
- clarificationOptions: 2-3 semantic choices with full first-person messages, or []
- finalMessage: the complete inferred first-person message when clear; when clarification is required, the safest useful first-person message that is already known before the missing detail is answered

If no clarification is required:
- needsClarification = false
- ambiguousField = ""
- clarificationQuestion = ""
- clarificationOptions = []
- finalMessage = the inferred first-person message

If clarification is required:
- needsClarification = true
- finalMessage = the broad message already established by the frames whenever one exists
- clarificationQuestion = the single missing detail
- every clarification option's finalMessage = the complete resolved sentence SignalBridge should say after the answer

Examples of the level of interpretation SignalBridge should produce:
- hands together beside cheek after a yawn-like motion -> "I'm tired and want to go to sleep."
- points to self, mimics drinking, then points to a backpack -> infer a request involving a drink from the backpack; if water vs medicine is genuinely unclear, speak the broad request first and then ask that semantic clarification
- waves toward another person -> "I need your attention." when that is the clear communicative goal

Confidence values are ranking signals, not statistical or medical certainty.
`;

function stripDataUrl(frame: string) {
  return frame.replace(/^data:image\/jpeg;base64,/, "");
}

export type FrameMeta = {
  t: number;
  motion: number;
};

export async function interpretFrames(
  frames: string[],
  meta?: FrameMeta[]
): Promise<SignalInterpretation> {
  if (frames.length === 0) {
    throw new Error("No frames supplied.");
  }

  const parts: any[] = [
    {
      text: instructions,
    },
  ];

  frames.forEach((frame, index) => {
    const info = meta?.[index];

    // Timing and measured motion let the model find the peak of the gesture
    // instead of weighting six near-identical stills equally.
    parts.push({
      text: info
        ? `Frame ${index + 1} of ${frames.length} · t=${info.t.toFixed(2)}s · motion=${info.motion.toFixed(2)}`
        : `Frame ${index + 1} of ${frames.length}`,
    });

    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: stripDataUrl(frame),
      },
    });
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.25,
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned no interpretation.");
  }

  return JSON.parse(response.text) as SignalInterpretation;
}
