/** Customer budget has one meaning throughout CRM: total course amount in IDR. */
export const CUSTOMER_BUDGET_CURRENCY = "IDR";
export const CUSTOMER_BUDGET_SCOPE = "whole_course";

/** Do not turn periodic amounts, ranges, foreign currency or unsupported numbers into a total. */
export function supportsCourseBudget(value: unknown, quote: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return false;
  if (
    !/预算|budget|anggaran|能花|能接受|可接受|最多花|spend|afford|mampu/i.test(
      quote,
    )
  )
    return false;
  if (
    /每月|每小时|每周|每年|每节|按月|按课时|per\s+(?:month|hour|week|year|lesson)|\/\s*(?:month|hour|bulan|jam)|per\s+(?:bulan|jam|minggu|tahun|sesi)/i.test(
      quote,
    )
  )
    return false;
  if (/USD|US\$|美元|人民币|RMB|CNY|SGD|新币|MYR|马币|EUR|欧元/i.test(quote))
    return false;
  if (
    /\d[\d.,]*\s*(?:万|千|百万|juta|ribu|million|thousand)?\s*(?:到|至|—|~|～|\bto\b|\bsampai\b|-)\s*\d/i.test(
      quote,
    )
  )
    return false;
  const amounts = [
    ...quote.matchAll(
      /\d[\d.,]*(?:\s*(?:百万|万|千|juta|ribu|million|thousand))?/gi,
    ),
  ].map(([raw]) => {
    const unit = raw
      .match(/百万|万|千|juta|ribu|million|thousand/i)?.[0]
      .toLowerCase();
    let number = raw
      .replace(/百万|万|千|juta|ribu|million|thousand/gi, "")
      .trim();
    if (/^\d{1,3}(?:[.,]\d{3})+$/.test(number))
      number = number.replace(/[.,]/g, "");
    else if (number.includes(".") && number.includes(",")) {
      const decimal = Math.max(
        number.lastIndexOf("."),
        number.lastIndexOf(","),
      );
      number =
        number.slice(0, decimal).replace(/[.,]/g, "") +
        "." +
        number.slice(decimal + 1);
    } else number = number.replace(",", ".");
    return (
      Number(number) *
      ({
        百万: 1e6,
        万: 1e4,
        千: 1e3,
        juta: 1e6,
        ribu: 1e3,
        million: 1e6,
        thousand: 1e3,
      }[unit || ""] || 1)
    );
  });
  for (const [raw] of quote.matchAll(
    /[零〇一二两三四五六七八九十百千万亿]+/g,
  )) {
    let total = 0,
      section = 0,
      number = 0;
    for (const char of raw) {
      const digit = "零一二三四五六七八九".indexOf(
        char === "两" ? "二" : char === "〇" ? "零" : char,
      );
      if (digit >= 0) {
        number = digit;
        continue;
      }
      const unit = (
        { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 } as Record<
          string,
          number
        >
      )[char];
      if (unit < 10000) {
        section += (number || 1) * unit;
        number = 0;
      } else {
        total += (section + number) * unit;
        section = 0;
        number = 0;
      }
    }
    amounts.push(total + section + number);
  }
  return amounts.some((amount) => Math.abs(amount - value) < 0.000001);
}
