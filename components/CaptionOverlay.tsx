"use client";

import ClarificationPanel from "@/components/ClarificationPanel";
import FinalMessage from "@/components/FinalMessage";
import type {
  ClarificationOption,
  SignalInterpretation,
} from "@/types/signalbridge";

type Props = {
  loading: boolean;
  error: string;
  result: SignalInterpretation | null;
  spokenWord: number;
  onChoose: (option: ClarificationOption) => void;
};

/**
 * The caption, sitting on the feed the way captions sit on video.
 *
 * Deliberately only the words — the controls and the transcript live below the
 * viewport, so the scrim never covers more of the camera than it has to.
 */
export default function CaptionOverlay({
  loading,
  error,
  result,
  spokenWord,
  onChoose,
}: Props) {
  const message =
    result && !result.needsClarification ? result.finalMessage : "";

  if (error) {
    return (
      <div className="rise">
        <p className="text-overlay text-white">Could not read that.</p>
        <p className="mt-2 max-w-xl text-body text-white/60">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="text-overlay text-white/45">Reading the interaction…</p>
    );
  }

  if (result?.needsClarification) {
    return <ClarificationPanel result={result} onChoose={onChoose} />;
  }

  if (message) {
    return <FinalMessage message={message} spokenWord={spokenWord} />;
  }

  return (
    <p className="text-overlay text-white/45">
      Press capture when you are ready.
    </p>
  );
}
