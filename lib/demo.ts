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
  actor: "The person by the window",
  intent: "Referring to something across the room",
  action: "Holds an open hand toward the far side of the room",
  objectCandidates: [
    { value: "Window", confidence: 0.54 },
    { value: "Jacket on the chair", confidence: 0.48 },
  ],
  location: "Living room",
  context: [
    "The gesture direction covers both the window and the chair.",
    "No object is held or touched in any frame.",
  ],
  needsClarification: true,
  ambiguousField: "objectCandidates",
  clarificationQuestion: "Which one do you mean?",
  clarificationOptions: [
    { label: "The window", finalMessage: "Could you open the window?" },
    { label: "My jacket", finalMessage: "Could you pass me my jacket?" },
  ],
  finalMessage: "",
};
