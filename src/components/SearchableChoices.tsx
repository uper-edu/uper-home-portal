import { useState } from "react";
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
  isLight,
  multiple = true,
}: {
  title: string;
  values: string[];
  choices: Choice[];
  onChange: (values: string[]) => void;
  zh: boolean;
  isLight: boolean;
  multiple?: boolean;
}) {
  const [query, setQuery] = useState("");
  const all = [
    ...choices,
    ...values
      .filter((v) => !choices.some((c) => c.value === v))
      .map((v) => ({
        value: v,
        label: (zh ? "历史值：" : "Historical value: ") + v,
      })),
  ];
  const matched = all.filter((c) =>
    (c.label + " " + c.value).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-1.5 min-w-0">
      <span className="text-xs font-semibold">{title}</span>
      <details className="relative" name="notification-choice">
        <summary
        role="button"
        aria-label={title}
          className={`cursor-pointer list-none flex justify-between items-center min-h-9 px-3 py-2 rounded-lg border text-xs ${isLight ? "bg-white border-slate-200" : "bg-slate-950 border-slate-700"}`}
        >
          <span>
            {values.length
              ? values
                  .map((v) => all.find((c) => c.value === v)?.label || v)
                  .join("、")
              : zh
                ? "全部"
                : "All"}
          </span>
          <span aria-hidden="true">▾</span>
        </summary>
        <div
          className={`absolute z-20 top-full left-0 right-0 mt-1 p-2 border rounded-xl shadow-lg ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-700"}`}
        >
          <input
            aria-label={title + (zh ? " 搜索" : " search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={zh ? "搜索选项" : "Search options"}
            className={`w-full h-8 px-2 mb-2 rounded-lg border text-xs ${isLight ? "bg-white border-slate-200" : "bg-slate-950 border-slate-700"}`}
          />
          {multiple && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-primary-600 mb-2"
            >
              {zh ? "清除筛选（全部）" : "Clear filter (all)"}
            </button>
          )}
          <div className="max-h-48 overflow-y-auto">
            {matched.map((c) => (
              <label
                key={c.value}
                className="flex items-start gap-2 py-2 px-1 text-xs cursor-pointer"
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={title}
                  checked={values.includes(c.value)}
                  onChange={() =>
                    onChange(
                      multiple
                        ? values.includes(c.value)
                          ? values.filter((v) => v !== c.value)
                          : [...values, c.value]
                        : [c.value],
                    )
                  }
                />
                <span>{c.label}</span>
              </label>
            ))}
            {!matched.length && (
              <p className="text-xs p-2">
                {zh ? "没有匹配选项" : "No matching options"}
              </p>
            )}
          </div>
        </div>
      </details>
      {multiple && values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={
                (zh ? "移除 " : "Remove ") +
                (all.find((c) => c.value === v)?.label || v)
              }
              className="text-[11px] rounded bg-primary-500/10 px-2 py-1"
            >
              {all.find((c) => c.value === v)?.label || v} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
