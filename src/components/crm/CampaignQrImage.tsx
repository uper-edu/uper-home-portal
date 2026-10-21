import {useCampaignQr} from "./useCampaignQr";

export function CampaignQrImage({qr, lang, alt, className = "w-48 h-48"}: {
  qr: ReturnType<typeof useCampaignQr>;
  lang: "en" | "id" | "zh";
  alt: string;
  className?: string;
}) {
  const text = (en: string, id: string, zh: string) => lang === "id" ? id : lang === "zh" ? zh : en;
  return <div className="text-slate-700" aria-busy={qr.status === "loading" || qr.status === "generated"}>
    {qr.dataUrl && <img key={qr.request} src={qr.dataUrl} alt={alt}
      onLoad={qr.loaded} onError={qr.failed} className={`${className} max-w-full mx-auto object-contain`}/>}
    {qr.status === "error" ? <div role="alert" className="max-w-56 mx-auto py-4 space-y-3 text-sm">
      <p>{text("QR code could not be loaded. Retry before printing.", "Kode QR gagal dimuat. Coba lagi sebelum mencetak.", "二维码加载失败，请重试后再打印。")}</p>
      <button type="button" onClick={qr.retry} className="px-3 py-2 rounded-xl border border-slate-400 bg-white text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary-700">
        {text("Retry QR code", "Coba lagi kode QR", "重试二维码")}
      </button>
    </div> : qr.status !== "ready" ? <p role="status" className="text-xs py-3">
      {text("Preparing QR code…", "Menyiapkan kode QR…", "正在准备二维码…")}
    </p> : <span className="sr-only" role="status">{text("QR code ready", "Kode QR siap", "二维码已就绪")}</span>}
  </div>;
}
