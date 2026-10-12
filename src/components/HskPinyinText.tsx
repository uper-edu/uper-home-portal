import React from "react";
import type { HskTextToken } from "../data/hskTextTokens";
interface HskPinyinTextProps {
  tokens: readonly HskTextToken[];
  className?: string;
  size?: "sm" | "base" | "lg";
}
/** Annotations are explicitly bound to source words or blanks, never guessed. */
export function HskPinyinText({
  tokens,
  className = "",
  size = "base",
}: HskPinyinTextProps) {
  const pinyinClass =
    size === "sm"
      ? "text-[10px] sm:text-[11px]"
      : size === "lg"
        ? "text-sm"
        : "text-xs";
  const hanziClass =
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base";
  return (
    <div
      className={`inline-flex flex-wrap items-end gap-x-2 gap-y-3 ${className}`}
    >
      {tokens.map((token, index) => (
        <span
          key={index}
          data-hsk-token={token.kind || "text"}
          className={`inline-flex max-w-full flex-col items-center justify-end ${token.kind === "blank" ? "min-w-12 whitespace-nowrap" : ""}`}
        >
          {token.pinyin && (
            <span
              data-hsk-pinyin
              className={`${pinyinClass} font-mono text-slate-500 mb-1 leading-tight whitespace-nowrap`}
            >
              {token.pinyin}
            </span>
          )}
          <span
            className={`${hanziClass} font-serif font-bold text-slate-900 leading-relaxed whitespace-pre-line`}
          >
            {token.hanzi}
          </span>
        </span>
      ))}
    </div>
  );
}
