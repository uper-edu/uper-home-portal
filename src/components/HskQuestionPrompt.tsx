import React from "react";
import { type RealHskQuestion } from "../data/hskQuizQuestions";
import {
  chooseText,
  stripSourceLabel,
  type HskLanguage,
} from "../data/hskAssessment";
import { HskPinyinText } from "./HskPinyinText";
/** Separate source passage and question without adding hints or changing their wording. */
export function HskQuestionPrompt({
  question,
  lang,
  compact = false,
}: {
  question: RealHskQuestion;
  lang: HskLanguage;
  compact?: boolean;
}) {
  const text = stripSourceLabel(question.promptText);
  if (question.format !== "passage_comprehension")
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 ${compact?'p-2':'p-3'}`}>
        <HskPinyinText
          tokens={question.promptTokens || [{ hanzi: text }]}
          size={compact?'base':'lg'}
        />
      </div>
    );
  const parts = text.split(/\n\s*\n(?=★)/u);
  const passage = parts.slice(0, -1).join("\n\n");
  const prompt = parts.length > 1 ? parts.at(-1)!.replace(/^★\s*/u, "") : text;
  return (
    <div className="space-y-3" data-hsk-passage>
      {passage && (
        <section
          aria-label={chooseText(lang, "阅读短文", "Reading passage", "Bacaan")}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          {passage.split(/\n\s*\n/u).map((paragraph, index) => (
            <p
              key={index}
              className="font-serif text-lg leading-loose [overflow-wrap:anywhere]"
            >
              {paragraph}
            </p>
          ))}
        </section>
      )}
      <p
        data-hsk-passage-question
        className="border-l-4 border-primary-600 pl-3 font-serif text-lg font-semibold leading-relaxed"
      >
        {prompt}
      </p>
    </div>
  );
}
