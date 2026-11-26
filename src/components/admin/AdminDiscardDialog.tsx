import {AdminConfirmation} from "./AdminConfirmation";
import {campaignUi,type CampaignUiLanguage} from "../../utils/campaignI18n";

export function AdminDiscardDialog({
  onKeep,
  onDiscard,
  isLight,
  title = "Unsaved changes",
  description = "Keep editing, or discard your unsaved changes and continue. Saved records stay unchanged.",
  keepLabel = "Keep editing",
  discardLabel = "Discard and continue",
  lang = "en",
  tone = "default",
  announceDescription = false,
  busy = false,
}: {
  onKeep: () => void;
  onDiscard?: () => void;
  isLight: boolean;
  lang?: CampaignUiLanguage;
  title?: string;
  description?: string;
  keepLabel?: string;
  discardLabel?: string;
  tone?: "default" | "danger";
  announceDescription?: boolean;
  busy?: boolean;
}) {
  const u=campaignUi(lang);
  return <AdminConfirmation light={isLight} danger={tone==='danger'} busy={busy} announceDescription={announceDescription}
    title={u(title)} description={u(description)} cancelLabel={u(keepLabel)} confirmLabel={u(discardLabel)}
    onCancel={onKeep} onConfirm={onDiscard}/>;
}
