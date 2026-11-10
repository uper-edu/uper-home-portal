import { useRef, useState } from "react";
import { CrmDiscardDialog } from "./CrmDetailWorkspace";
import { crmId } from "../../utils/crmIndonesian";
import { crmError, type CrmLanguage } from "../../utils/crmLanguage";

type Receipt = {
  requestId: string;
  version: string;
  simulated: boolean;
  state: "pending" | "accepted" | "rejected" | "unknown";
  received: boolean;
};

export type LarkChannelTest = {
  version: string;
  simulated: boolean;
  blocked: "missing_webhook" | "missing_signing_secret" | "missing_app" | "missing_binding" | "live_unavailable" | null;
  latest: Receipt | null;
};

export function LarkChannelTestControls({ id, name, test, lang, isLight, request, personal = false }: {
  id: string;
  name: string;
  test: LarkChannelTest;
  lang: CrmLanguage;
  isLight: boolean;
  request: (path: string, body?: unknown) => Promise<any>;
  personal?: boolean;
}) {
  const t = (en: string, zh: string) => lang === "zh" ? zh : lang === "id" ? crmId(en) : en;
  const [view, setView] = useState<"send" | "result" | "receive" | null>(null);
  const [confirmation, setConfirmation] = useState({ version: test.version, simulated: test.simulated });
  const [localReceipt, setLocalReceipt] = useState<Receipt | null>(null);
  const [dismissedReceipt, setDismissedReceipt] = useState("");
  const [unresolved, setUnresolved] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [working, setWorking] = useState(false);
  const currentLocalReceipt = localReceipt?.version === test.version ? localReceipt : null;
  const receipt = currentLocalReceipt?.state === "pending" && test.latest?.requestId === currentLocalReceipt.requestId
    ? test.latest : currentLocalReceipt ?? test.latest;
  const path = "notification-channels/" + encodeURIComponent(id) + "/test-message";
  const blockedText = test.blocked && ({
    missing_webhook: null,
    missing_signing_secret: t("Configure the signing secret first.", "请先配置签名密钥。"),
    missing_app: t("Configure the Lark app before testing.", "请先配置 Lark 应用。"),
    missing_binding: t("Link your Lark account in Notification settings before testing.", "请先在右上角账号菜单的「通知设置」中绑定 Lark。"),
    live_unavailable: t("Live sending is unavailable in this environment.", "此环境无法真实发送。"),
  })[test.blocked];

  const needsCheck = Boolean(unresolved || receipt?.state === "pending");
  const canConfirmReceipt = receipt?.state === "accepted" && !receipt.simulated && !receipt.received;

  function open() {
    if (working || needsCheck || (canConfirmReceipt && receipt.requestId !== dismissedReceipt)) {
      setView("result");
      return;
    }
    setConfirmation({ version: test.version, simulated: test.simulated });
    setError("");
    setView("send");
  }

  function close() {
    if (view === "receive") {
      setView("result");
      return;
    }
    if (view === "result" && canConfirmReceipt) setDismissedReceipt(receipt.requestId);
    setView(null);
  }

  async function run(action: "send" | "receive" | "check") {
    if (busy.current) return;
    const requestId = action === "send" ? crypto.randomUUID() : unresolved || receipt?.requestId;
    if (!requestId) return;
    busy.current = true;
    setWorking(true);
    setError("");
    setView("result");
    try {
      const result: Receipt = action === "send"
        ? await request(path, { requestId, version: confirmation.version, confirmed: true })
        : action === "receive"
          ? await request(path + "/" + requestId + "/received", {})
          : await request(path + "/" + requestId);
      setLocalReceipt(result);
      setUnresolved("");
    } catch (error) {
      const failure = error as Error & {status?: number};
      if (action === "send" && (!failure.status || failure.status >= 500)) setUnresolved(requestId);
      else setError(failure.message);
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  function resultText() {
    if (working) return t("Processing…", "处理中…");
    if (error) return crmError(error, lang);
    if (needsCheck) return t("The test result is unconfirmed. Check it before sending again.", "测试结果尚未确认，请先核对。");
    if (!receipt) return t("Test result unavailable.", "暂时无法查看测试结果。");
    if (receipt.state === "rejected") return t("Lark rejected the test message.", "Lark 拒绝了测试消息。");
    if (receipt.simulated && receipt.state === "accepted") return t("Simulation completed; no message sent.", "模拟测试完成，未发送消息。");
    const status = receipt.state === "unknown"
      ? personal ? t("Lark acceptance is unknown. Check your Lark messages first.", "Lark 接收结果未知。请先在个人 Lark 中核对。")
        : t("Lark acceptance is unknown. Check the group first.", "Lark 接收结果未知。请先在群内核对。")
      : personal
        ? receipt.received ? t("Lark accepted · personal receipt confirmed", "Lark 已接收 · 私信实收已确认")
          : t("Lark accepted · personal receipt unconfirmed", "Lark 已接收 · 私信实收待确认")
        : receipt.received ? t("Lark accepted · group receipt confirmed", "Lark 已接收 · 群内实收已确认")
          : t("Lark accepted · group receipt unconfirmed", "Lark 已接收 · 群内实收待确认");
    return status + " " + t("Verification code", "核对码") + " " + receipt.requestId;
  }

  function sendDescription() {
    if (personal) return confirmation.simulated
      ? t("This test simulates a receipt without sending to your Lark account.", "本次仅模拟回执，不会向你的 Lark 账号发送。")
      : t("Send one TEST message to your linked Lark account. It contains no customer data.", "确认后向你已绑定的 Lark 账号发送一条 TEST 消息，不含客户资料。");
    return confirmation.simulated
      ? t("This test simulates a receipt without sending to the Lark group.", "本次仅模拟回执，不会向 Lark 群发送。")
      : t("Verify the group associated with the Webhook. Confirm to send one TEST message without customer data.", "请核对 Webhook 对应的群。确认后发送一条不含客户资料的 TEST 消息。");
  }

  const dialog = view === "send" ? {
    title: personal ? t("Confirm personal test message", "确认个人通知测试") : t("Confirm test destination", "确认测试目标群"),
    description: name + " · " + sendDescription(),
    keepLabel: t("Cancel", "取消"),
    discardLabel: confirmation.simulated ? t("Confirm simulation", "确认模拟") : t("Confirm and send", "确认发送"),
    onDiscard: () => void run("send"),
  } : view === "result" ? {
    title: t("Test result", "测试结果"),
    description: resultText(),
    keepLabel: t("Close", "关闭"),
    discardLabel: needsCheck ? t("Check test result", "核对测试结果")
      : personal ? t("Confirm personal receipt", "确认私信实收") : t("Confirm group receipt", "确认群内实收"),
    onDiscard: working ? undefined : needsCheck ? () => void run("check")
      : canConfirmReceipt && !error ? () => setView("receive") : undefined,
  } : view === "receive" ? {
    title: personal ? t("Confirm you received it?", "确认已收到私信？") : t("Confirm the group received it?", "确认群内已收到？"),
    description: personal
      ? t("Find the TEST message with the matching verification code in your Lark messages before confirming receipt.", "请在个人 Lark 中找到核对码一致的 TEST 消息，再确认实收。")
      : t("Find the TEST message with the matching verification code in the group before confirming receipt.", "请在群内找到核对码一致的 TEST 消息，再确认实收。"),
    keepLabel: t("Cancel", "取消"),
    discardLabel: t("Confirm receipt", "确认实收"),
    onDiscard: () => void run("receive"),
  } : null;
  return <>
    <button type="button" className="crm-work-button" disabled={Boolean(test.blocked)}
      title={blockedText || undefined} onClick={open}>
      {t("Send test message", "发送测试消息")}
    </button>
    {blockedText && <p className="notification-channel-help notification-channel-test-help">{blockedText}</p>}
    {dialog && <CrmDiscardDialog {...dialog} lang={lang} isLight={isLight} announceDescription onKeep={close}/>}
  </>;
}
