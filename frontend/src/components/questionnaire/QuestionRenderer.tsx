"use client";

import type { ScaleQuestion } from "@/types/prs.types";
import { LikertInput } from "./LikertInput";
import { VASSlider } from "./VASSlider";
import { NumericInput } from "./NumericInput";
import { TimeInput } from "./TimeInput";
import { TextInput } from "./TextInput";

interface QuestionRendererProps {
  question: ScaleQuestion;
  scaleId: string;
  value: number | string | undefined;
  onAnswer: (questionIndex: number, value: number | string) => void;
  questionNumber: number;
  totalQuestions: number;
  isVoiceMode?: boolean;
  readOnly?: boolean;
  showHeader?: boolean;
}

export function QuestionRenderer({
  question,
  scaleId,
  value,
  onAnswer,
  questionNumber,
  totalQuestions,
  isVoiceMode = false,
  readOnly = false,
  showHeader = true,
}: QuestionRendererProps) {
  const handleAnswer = (val: number | string) => {
    onAnswer(question.index, val);
  };

  if (!showHeader) {
    return renderInput(question, value, handleAnswer, readOnly);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-primary-500 uppercase tracking-wide">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>

      <h3 className="text-lg font-medium text-neutral-900 leading-relaxed">
        {question.label}
      </h3>

      <div className="mt-4">{renderInput(question, value, handleAnswer, readOnly)}</div>
    </div>
  );
}

function renderInput(
  question: ScaleQuestion,
  value: number | string | undefined,
  onAnswer: (val: number | string) => void,
  readOnly: boolean,
) {
  switch (question.type) {
    case "likert":
    case "functional":
      return (
        <LikertInput
          options={question.options || []}
          value={value as number | undefined}
          onChange={onAnswer}
          readOnly={readOnly}
        />
      );
    case "vas":
    case "nrs":
      return (
        <VASSlider
          min={question.min ?? 0}
          max={question.max ?? 100}
          step={question.step ?? 1}
          value={value as number | undefined}
          onChange={onAnswer}
          readOnly={readOnly}
        />
      );
    case "numeric":
      return (
        <NumericInput
          min={question.min}
          max={question.max}
          value={value as number | undefined}
          onChange={onAnswer}
          options={question.options}
          readOnly={readOnly}
        />
      );
    case "time":
      return (
        <TimeInput
          value={value as string | undefined}
          onChange={onAnswer}
          readOnly={readOnly}
        />
      );
    case "text":
      return (
        <TextInput
          value={value as string | undefined}
          onChange={onAnswer}
          readOnly={readOnly}
        />
      );
    default:
      if (question.options && question.options.length > 0) {
        return (
          <LikertInput
            options={question.options}
            value={value as number | undefined}
            onChange={onAnswer}
            readOnly={readOnly}
          />
        );
      }
      return <p className="text-neutral-500">Unsupported question type: {question.type}</p>;
  }
}
