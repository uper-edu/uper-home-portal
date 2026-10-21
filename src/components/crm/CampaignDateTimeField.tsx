import React, { useId } from "react";
import {
  campaignDateTimeValue,
  splitCampaignDateTime,
  type CampaignScheduleParts,
} from "../../utils/campaignScheduleInput";
import { campaignUi, type CampaignUiLanguage } from "../../utils/campaignI18n";

export function CampaignDateTimeField({
  name,
  label,
  date,
  time,
  min,
  onChange,
  lang = "en",
}: {
  lang?: CampaignUiLanguage;
  name: string;
  label: string;
  date: string;
  time: string;
  min?: string;
  onChange: (parts: CampaignScheduleParts) => void;
}) {
  const u = campaignUi(lang);
  const id = useId();
  const value = campaignDateTimeValue(date, time);
  const partial = Boolean((date || time) && !value);
  const readInput = (input: HTMLInputElement) => {
    // A partially typed native date/time has an empty value but is not an intentional clear.
    if (input.validity.badInput) return;
    const parts = splitCampaignDateTime(input.value);
    if (parts) onChange(parts);
  };
  return (
    <div className="campaign-field campaign-datetime-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="datetime-local"
        step="60"
        value={value}
        min={min || undefined}
        aria-describedby={partial ? `${id}-partial` : undefined}
        onInput={(e) => readInput(e.currentTarget)}
        onChange={(e) => readInput(e.currentTarget)}
      />
      {partial && (
        <div id={`${id}-partial`} className="campaign-datetime-partial">
          <p>
            {u("Recorded: {date} · {time}. Kept until replaced or cleared.", {
              date: date || u("Date not recorded"),
              time: time || u("Time not recorded"),
            })}
          </p>
          <button
            type="button"
            onClick={() => onChange({ date: "", time: "" })}
          >
            {u("Clear {label}", {
              label: lang === "en" ? label.toLowerCase() : label,
            })}
          </button>
        </div>
      )}
    </div>
  );
}
