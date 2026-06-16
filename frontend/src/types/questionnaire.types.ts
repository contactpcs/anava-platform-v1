import { ScaleDefinition, ScaleQuestion } from "./prs.types";

export interface QuestionnaireState {
  sessionId: string;
  scaleOrder: string[];
  currentScaleIndex: number;
  currentQuestionIndex: number;
  responses: Record<string, Record<string, number | string>>;
  isVoiceMode: boolean;
  isAutoSaving: boolean;
}

export interface QuestionRendererProps {
  question: ScaleQuestion;
  scaleId: string;
  value: number | string | undefined;
  onAnswer: (questionIndex: number, value: number | string) => void;
  isVoiceMode?: boolean;
  readOnly?: boolean;
}

export interface ScaleProgress {
  scaleId: string;
  totalQuestions: number;
  answeredQuestions: number;
  isComplete: boolean;
  isSkipped: boolean;
}

export interface VoiceModeState {
  isListening: boolean;
  isReading: boolean;
  transcript: string;
  error: string | null;
}
