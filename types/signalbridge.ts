export type Candidate = {
  value: string;
  confidence: number;
};

export type SignalInterpretation = {
  actor: string;
  intent: string;
  action: string;
  objectCandidates: Candidate[];
  location: string;
  context: string[];
  needsClarification: boolean;
  ambiguousField: string;
  clarificationQuestion: string;
  clarificationOptions: string[];
  finalMessage: string;
};
