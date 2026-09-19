import type {
  Candidate,
  ClarificationOption,
  SignalInterpretation,
} from "@/types/signalbridge";

/**
 * Confidence is a ranking signal, not a statistic — the model prompt says so
 * explicitly. Sort by it, then show rank. Never render it as a percentage.
 */
export function rankCandidates(candidates: Candidate[]) {
  return [...candidates].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Turn the person's answer to the clarification question into the sentence.
 *
 * Each option already carries a full first-person message written by the model,
 * so this stays local and synchronous: they have just told us what they meant,
 * and a second round trip (which can fail on venue wifi) would be slower without
 * being any more accurate.
 */
export function resolveWithChoice(
  result: SignalInterpretation,
  option: ClarificationOption
): SignalInterpretation {
  const message = option.finalMessage.trim() || option.label.trim();

  return {
    ...result,
    needsClarification: false,
    ambiguousField: "",
    clarificationQuestion: "",
    clarificationOptions: [],
    finalMessage: message,
  };
}

function wrap(text: string, width: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines;
}

/**
 * Broadcast captioning practice: at most two lines, balanced, broken on word
 * boundaries. A caption read from across a room fails at three lines.
 */
export function toCaptionLines(text: string, width = 32) {
  const trimmed = text.trim();

  if (!trimmed) return [];

  let current = width;
  let lines = wrap(trimmed, current);

  while (lines.length > 2 && current < 80) {
    current += 4;
    lines = wrap(trimmed, current);
  }

  // Balance the two lines so the second is not a single orphaned word.
  if (lines.length === 2) {
    const balanced = wrap(trimmed, Math.ceil(trimmed.length / 2));
    if (balanced.length === 2) return balanced;
  }

  return lines;
}
