/** A denial, historical quote or withdrawal can govern a request across clause boundaries. */
export function bookingRequestSuppressed(text:string):boolean {
 const value=text.normalize('NFKC');
 return /(?:没有说|没说过|并未说|从未说|并不是说|不是说).{0,30}(?:预约|试听)|(?:之前|以前|曾经|原来|刚才|先前).{0,16}(?:说|想|要|希望).{0,20}(?:预约|试听)|不约了|不预约|不想约|暂不约|先不约|(?:撤回|取消).{0,12}(?:预约|试听)/u.test(value)
 || /\b(?:did\s+not\s+say|didn't\s+say|never\s+said|previously\s+said|used\s+to\s+want).{0,70}\b(?:book|schedule|reserve|trial)\b|\b(?:no\s+longer|don't|do\s+not)\s+(?:want\s+to\s+)?(?:book|schedule|reserve)\b|\b(?:cancel|withdraw)[^,.;!?\n]{0,35}\b(?:booking|trial|reservation)\b/iu.test(value)
 || /\b(?:tidak\s+pernah\s+(?:bilang|mengatakan)|dulu\s+(?:saya\s+)?(?:bilang|ingin|mau)|sebelumnya\s+(?:saya\s+)?(?:bilang|ingin|mau)|(?:tidak|nggak)\s+jadi|batalkan|batal).{0,65}\b(?:booking|pesan|memesan|menjadwalkan|reservasi|trial|percobaan)\b/iu.test(value);
}

export type ChatRequestAction = "handoff" | "booking" | "enrollment";

/** Conservative UI routing of explicit requests, not AI-generated sales decisions.
 * General questions, negated/conditional requests and conflicting actions stay in AI consultation. */
export function explicitChatRequest(
  text: string,
): ChatRequestAction | undefined {
  if (
    /["“「『].*["”」』]|(?:^|\s)'[^']{3,}'(?:\s|$)|\b(?:translate|example|explain|terjemah|contoh)\b|翻译|举例|例如|比如/iu.test(
      text,
    )
  )
    return undefined;
  // A leading condition still governs its request after a comma.
  if (/^\s*(?:if\b|jika\b|kalau\b|如果|假如)/iu.test(text)) return undefined;
  const actions = new Set<ChatRequestAction>();
  for (const clause of text
    .normalize("NFKC")
    .split(/[，,。；;！？!?\n]|\bbut\b|但是|\btapi\b|\btetapi\b/iu)) {
    if (
      /不想|不要|不用|不需要|暂不|取消|如果|假如|还没决定|怎么|如何|流程|(?:do\s+not|don['’]t|not\s+ready|not\s+yet|cancel|just\s+asking|how\s+(?:to|can|do)|if|maybe|tidak|jangan|belum|batal|jika|kalau|mungkin|bagaimana)\b/iu.test(
        clause,
      )
    )
      continue;
    if (
      /(?:请|麻烦).{0,8}(?:顾问|老师|人工|真人).{0,8}(?:联系我|给我回电)|(?:我想|我要|请|帮我)(?:转人工|联系(?:真人|人工|顾问))|^(?:\s*)(?:转人工|人工客服|真人客服|找真人|安排顾问联系)(?:\s*)$|(?:please\s+)?(?:ask|have)\s+(?:an?\s+)?(?:human\s+)?(?:advis[oe]r|teacher)\s+(?:to\s+)?(?:contact|call)\s+me|(?:i\s+(?:would\s+like|want|need)\s+to|i['’]d\s+like\s+to|please)\s+(?:talk|speak)\s+(?:to|with)\s+(?:a\s+)?(?:human|advis[oe]r)|(?:tolong|mohon).{0,30}(?:konsultan|guru|manusia).{0,20}(?:hubungi|menghubungi|telepon).{0,8}saya|saya\s+(?:ingin|mau)\s+(?:bicara|berbicara).{0,20}(?:konsultan|manusia)/iu.test(
        clause,
      )
    )
      actions.add("handoff");
    if (
      /(?:我想|我要|我希望|请帮我|帮我)(?:先|现在)?(?:预约|预订|安排)(?:一次|一节|一个)?(?:试听|试课|体验课|课程咨询|咨询)|^\s*预约试听\s*$|(?:i\s+(?:would\s+like|want)\s+to|i['’]d\s+like\s+to|please(?:\s+help\s+me)?)\s+(?:book|schedule|reserve)\s+(?:a\s+|an\s+)?(?:trial|demo|consultation|lesson|class)|(?:saya\s+(?:ingin|mau)|tolong(?:\s+bantu\s+saya)?|mohon)\s+(?:memesan|pesan|menjadwalkan|jadwalkan|reservasi|booking).{0,20}(?:kelas\s+percobaan|kelas\s+trial|konsultasi|trial|uji\s+coba)/iu.test(
        clause,
      )
    )
      actions.add("booking");
    if (
      /(?:我想|我要|我希望|请帮我|帮我)(?:现在|直接|正式)?(?:报名|注册课程|报班)|(?:i\s+(?:would\s+like|want)\s+to|i['’]d\s+like\s+to|please(?:\s+help\s+me)?)\s+(?:enroll?\b|sign\s+up\b|register\s+for\s+(?:a\s+|the\s+)?(?:course|class))|saya\s+(?:ingin|mau)\s+(?:mendaftar|daftar)\b|tolong\s+bantu\s+saya\s+(?:mendaftar|daftar)\b/iu.test(
        clause,
      )
    )
      actions.add("enrollment");
  }
  if (bookingRequestSuppressed(text)) actions.delete('booking');
  return actions.size === 1 ? [...actions][0] : undefined;
}
