import type { SignalInterpretation } from "@/types/signalbridge";

/**
 * Recorded readings.
 *
 * Venue wifi, camera permission and model quota all fail at the worst possible
 * moment. These let both outcomes — a clear reading and an ambiguous one — be
 * shown instantly, with no camera and no network.
 */

export const DEMO_CLEAR: SignalInterpretation = {
  actor: "The person at the table",
  intent: "Asking for a drink",
  action: "Points twice toward the glass, then looks back at the listener",
  objectCandidates: [
    { value: "Water glass", confidence: 0.86 },
    { value: "Mug behind it", confidence: 0.31 },
  ],
  location: "Kitchen table",
  context: [
    "The pointing gesture repeats across frames 2 to 5.",
    "Gaze returns to the listener after each point.",
  ],
  needsClarification: false,
  ambiguousField: "",
  clarificationQuestion: "",
  clarificationOptions: [],
  finalMessage: "I would like some water, please.",
};

export const DEMO_AMBIGUOUS: SignalInterpretation = {
  actor: "You",
  intent: "Reports chest discomfort",
  action: "Touches chest and signals discomfort",
  objectCandidates: [],
  location: "",
  context: [
    "The chest area is intentionally referenced across multiple frames.",
    "The broad message is clear, but the quality of the discomfort is not visible.",
  ],
  needsClarification: true,
  ambiguousField: "discomfortType",
  clarificationQuestion: "What type of discomfort?",
  clarificationOptions: [
    { label: "Sharp", finalMessage: "I have sharp chest discomfort." },
    { label: "Pressure", finalMessage: "I feel pressure in my chest." },
    { label: "Burning", finalMessage: "I have a burning discomfort in my chest." },
  ],
  finalMessage: "I have chest discomfort.",
};
