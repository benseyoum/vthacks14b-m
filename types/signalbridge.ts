export type Candidate = {
  value: string;
  confidence: number;
};

export type ClarificationOption = {
  label: string;
  finalMessage: string;
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
  clarificationOptions: ClarificationOption[];
  finalMessage: string;
};
