import React from 'react';

export interface PinyinWordToken {
  pinyin: string;
  hanzi: string;
}

interface HskPinyinTextProps {
  tokens?: PinyinWordToken[];
  pinyinStr?: string;
  hanziStr?: string;
  className?: string;
  size?: 'sm' | 'base' | 'lg';
}

/**
 * Standard HSK Pinyin Word Segmented Text Component
 * Renders Chinese words with standard pinyin orthography (分词连写) aligned centered above each word.
 */
export function HskPinyinText({
  tokens,
  pinyinStr,
  hanziStr,
  className = '',
  size = 'base'
}: HskPinyinTextProps) {
  // If tokens provided directly, use them
  let parsedTokens: PinyinWordToken[] = tokens || [];

  // If pinyinStr or hanziStr provided, parse into aligned word tokens
  if (!parsedTokens.length && (pinyinStr || hanziStr)) {
    const pyWords = pinyinStr ? pinyinStr.trim().split(/\s+/) : [];
    const hzWords = hanziStr ? hanziStr.trim().split(/\s+/) : [];

    if (pyWords.length > 0 && pyWords.length === hzWords.length) {
      parsedTokens = pyWords.map((py, i) => ({
        pinyin: py,
        hanzi: hzWords[i]
      }));
    } else {
      parsedTokens = hzWords.map((hz, i) => ({
        pinyin: pyWords[i] || '',
        hanzi: hz
      }));
    }
  }

  const pinyinClass = size === 'sm' 
    ? 'text-[10px] sm:text-[11px] font-mono text-slate-500 mb-0.5 leading-none' 
    : size === 'lg'
    ? 'text-xs sm:text-sm font-mono text-slate-500 mb-1 leading-none'
    : 'text-[11px] sm:text-xs font-mono text-slate-500 mb-0.5 leading-none';

  const hanziClass = size === 'sm'
    ? 'text-xs sm:text-sm font-serif font-bold text-slate-900 leading-none'
    : size === 'lg'
    ? 'text-base sm:text-lg font-serif font-bold text-slate-900 leading-none'
    : 'text-sm sm:text-base font-serif font-bold text-slate-900 leading-none';

  return (
    <div className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-2.5 ${className}`}>
      {parsedTokens.map((token, idx) => (
        <span key={idx} className="inline-flex flex-col items-center justify-end">
          {token.pinyin && (
            <span className={pinyinClass}>
              {token.pinyin}
            </span>
          )}
          <span className={hanziClass}>
            {token.hanzi}
          </span>
        </span>
      ))}
    </div>
  );
}
