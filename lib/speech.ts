export function speakMessage(message: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  if (!message.trim()) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}
