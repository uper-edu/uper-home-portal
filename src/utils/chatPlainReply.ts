// Keep this subset conservative. Anything that might contain Markdown or a
// GFM autolink goes through the same parser as before.
export function plainChatParagraphs(content:string) {
  const paragraphs=content.split(/\n{2,}/);
  if (paragraphs.every(paragraph=>
    paragraph===paragraph.trim() &&
    /^[\p{L}\p{M}\p{N} .,!?:;'’…，。！？、；：“”‘’（）—–·]+$/u.test(paragraph) &&
    !/^\d{1,9}\.(?: |$)/.test(paragraph) &&
    !/www\./i.test(paragraph)
  )) return paragraphs;
}
