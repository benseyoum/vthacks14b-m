"use client";

import type {
  ClarificationOption,
  SignalInterpretation,
} from "@/types/signalbridge";

type Props = {
  result: SignalInterpretation;
  onChoose: (option: ClarificationOption) => void;
};

/**
 * The most important moment in the product.
 *
 * When two readings are both plausible the model refuses to guess and asks one
 * question instead. If part of the message is already clear, show and speak it
 * first so clarification adds detail rather than silencing the communicator.
 */
export default function ClarificationPanel({ result, onChoose }: Props) {
  const knownMessage = result.finalMessage.trim();

  return (
    <div className="rise">
      {knownMessage && (
        <p className="mb-2 text-body font-medium text-white/70">
          {knownMessage}
        </p>
      )}

      <p className="text-overlay text-white">
        {result.clarificationQuestion}
      </p>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {result.clarificationOptions.map((option) => (
          <button
            key={`${option.label}-${option.finalMessage}`}
            type="button"
            onClick={() => onChoose(option)}
            className="min-h-12 rounded-full bg-white px-6 text-base font-semibold text-panel shadow-pill transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
