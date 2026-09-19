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
      items: { type: "string" },
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
You are the perception and intent-understanding layer for SignalBridge.

SignalBridge helps someone communicate when they know what they want to say
but cannot easily get the words out.

You will receive FOUR camera frames in chronological order from one short
nonverbal interaction.

Treat the frames as a sequence.

Look for:
- pointing
- body gestures
- hand gestures
- interactions with visible objects
- direction of attention
- repeated motion
- visible environmental context

Infer only meaning supported by visible evidence.

Return:
- actor: who is communicating
- intent: the likely communicative goal
- action: the visible action or gesture
- objectCandidates: relevant objects, ranked
- location: relevant visible location if any
- context: brief useful observations
- needsClarification: whether meaning is materially ambiguous
- ambiguousField: the most important unresolved part
- clarificationQuestion: ONE short question that would resolve the ambiguity
- clarificationOptions: 2 or 3 easy choices
- finalMessage: a short natural first-person sentence ONLY if sufficiently clear

IMPORTANT:
Do not pretend uncertainty is certainty.

If multiple substantially different meanings remain plausible,
needsClarification MUST be true.

Ask only ONE clarification question, targeting the highest-impact ambiguity.

If no clarification is required:
- needsClarification = false
- ambiguousField = ""
- clarificationQuestion = ""
- clarificationOptions = []
- finalMessage = the inferred first-person message

If clarification is required:
- finalMessage = ""

Never diagnose medical conditions.
Never infer sensitive traits.
Do not claim a formal sign-language translation unless evidence truly supports it.

Confidence values are ranking signals, not medical or statistical certainty.
`;

function stripDataUrl(frame: string) {
  return frame.replace(/^data:image\/jpeg;base64,/, "");
}

export async function interpretFrames(
  frames: string[]
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
    parts.push({
      text: `Frame ${index + 1} of ${frames.length}`,
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
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned no interpretation.");
  }

  return JSON.parse(response.text) as SignalInterpretation;
}
