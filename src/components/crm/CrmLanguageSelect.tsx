import type { CrmLanguage } from "../../utils/crmLanguage";
export function CrmLanguageSelect({
  lang,
  onChange,
}: {
  lang: CrmLanguage;
  onChange: (value: CrmLanguage) => void;
}) {
  return (
    <select
      aria-label={
        lang === "zh"
          ? "界面语言"
          : lang === "id"
            ? "Bahasa antarmuka"
            : "Interface language"
      }
      value={lang}
      onChange={(event) => onChange(event.target.value as CrmLanguage)}
      className="bg-transparent border rounded-lg px-2 py-1 text-sm max-w-full"
    >
      <option value="en">English</option>
      <option value="id">Bahasa Indonesia</option>
      <option value="zh">中文</option>
    </select>
  );
}
