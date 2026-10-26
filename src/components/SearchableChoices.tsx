import {AdminFieldLabel} from './AdminForm';
import { crmId } from "../utils/crmIndonesian";
import { CrmSingleSelect } from "./crm/CrmSingleSelect";
export interface Choice {
  value: string;
  label: string;
}
export default function SearchableChoices({
  title,
  values,
  choices,
  onChange,
  zh,
  lang = zh ? "zh" : "en",
  isLight,
  multiple = true,
  required = false,
}: {
  title: string;
  required?:boolean;
  values: string[];
  choices: Choice[];
  onChange: (values: string[]) => void;
  zh: boolean;
  lang?: "en" | "zh" | "id";
  isLight: boolean;
  multiple?: boolean;
}) {
  const t = (en: string, chinese: string) =>
    lang === "id" ? crmId(en) : lang === "zh" ? chinese : en;
  const all = [
    ...choices,
    ...values
      .filter((value) => !choices.some((choice) => choice.value === value))
      .map((value) => ({
        value,
        label: t("Historical value: ", "历史值：") + value,
      })),
  ];
  return (
    <div className="space-y-1.5 min-w-0">
      <span className="text-xs font-semibold"><AdminFieldLabel required={required}>{title}</AdminFieldLabel></span>
      <CrmSingleSelect
        label={title}
        required={required}
        value={values[0] || ""}
        options={all}
        onChange={(value) => onChange([value])}
        multiple={multiple}
        values={values}
        onValuesChange={onChange}
        emptyLabel={t("All", "全部")}
        searchable
        searchByValue
        lang={lang}
        isLight={isLight}
      />
      {multiple && values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => onChange(values.filter((item) => item !== value))}
              aria-label={
                t("Remove ", "移除 ") +
                (all.find((choice) => choice.value === value)?.label || value)
              }
              className="text-[11px] rounded bg-primary-500/10 px-2 py-1"
            >
              {all.find((choice) => choice.value === value)?.label || value} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
