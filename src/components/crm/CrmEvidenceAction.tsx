import { useCrmUiText } from "./CrmUiLanguage";
import { useId, useState } from "react";
import { FileSearch, MessageSquareText, NotebookText, ChevronDown, ArrowRight, CornerDownRight } from "lucide-react";
/** Compact source navigation; business callbacks and permissions stay with the caller. */
export function CrmEvidenceAction({
  kind = "evidence",
  description,
  onClick,
  expanded,
  controls,
  label: customLabel,
  behavior,
}: {
  label?: string;
  behavior?: "expand" | "locate" | "open";
  kind?: "evidence" | "conversation" | "record";
  description: string;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
}) {
  const ui = useCrmUiText();
  const id = useId(),
    [dismissed, setDismissed] = useState(false),
    Icon =
      kind === "conversation"
        ? MessageSquareText
        : kind === "record"
          ? NotebookText
          : FileSearch;
  const label =
    kind === "conversation" ? "对话" : kind === "record" ? "记录" : "依据";
  const mode = behavior || (expanded !== undefined ? "expand" : kind === "conversation" ? "open" : "locate");
  const ActionIcon = mode === "expand" ? ChevronDown : mode === "open" ? ArrowRight : CornerDownRight;
  return (
    <span
      className="crm-evidence-action"
      data-dismissed={dismissed || undefined}
      onMouseEnter={() => setDismissed(false)}
    >
      <button
        type="button"
        className="crm-evidence-action-button"
        data-evidence-behavior={mode}
        aria-label={description}
        aria-describedby={id}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
        onFocus={() => setDismissed(false)}
        onBlur={() => setDismissed(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDismissed(true);
            e.stopPropagation();
          }
        }}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{ui(customLabel || label)}</span>
        <ActionIcon size={12} aria-hidden="true" className="crm-evidence-behavior-icon" />
      </button>
      <span className="crm-evidence-tooltip" id={id} role="tooltip">
        {description} · {ui(mode === "expand" ? "就地展开原文" : mode === "open" ? "打开完整记录" : "定位对应原文")}
      </span>
    </span>
  );
}
