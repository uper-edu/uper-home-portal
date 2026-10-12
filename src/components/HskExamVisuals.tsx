import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findHskVersion } from "../data/hskAssessmentVersions";
import manifest from "../data/hskPdfImages.json";
import examples from "../data/hskPdfExamples.json";
import { chooseText, type HskLanguage } from "../data/hskAssessment";
interface HskImageProps {
  id: string;
  className?: string;
  lang?: HskLanguage;
  label?: string;
  onUnavailable?: () => void;
  examVersion?: string;
  scoringVersion?: string;
}
/** Read-only source crops. Image tools never select an answer or reveal its meaning. */
export function HskExamImage({
  id,
  className = "w-full h-24 sm:h-32",
  lang = "en",
  label,
  onUnavailable,
  examVersion,
  scoringVersion,
}: HskImageProps) {
  const assets: Record<string, { src: string }> = examVersion
    ? findHskVersion(examVersion, scoringVersion)?.imageAssets || {}
    : { ...manifest.assets, ...examples.assets };
  const asset = assets[id];
  const [imgError, setImgError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  const imageLabel =
    label || t("PDF题图", "PDF question image", "Gambar soal PDF");
  const source = asset
    ? asset.src + (retry ? `?hskRetry=${retry}` : "")
    : undefined;
  useEffect(() => {
    setImgError(false);
    setRetry(0);
    setExpanded(false);
  }, [asset?.src]);
  useEffect(() => {
    if (!expanded) return;
    setZoomed(false);
    const dialog = dialogRef.current;
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [expanded]);
  const failed = () => {
    setImgError(true);
    setExpanded(false);
    onUnavailable?.();
  };
  return (
    <div className="min-w-0">
      <div
        className={`${className} bg-white rounded-lg p-1 flex items-center justify-center border border-slate-200 overflow-hidden`}
      >
        {asset && !imgError ? (
          <img
            key={source}
            src={source}
            alt={imageLabel}
            onError={failed}
            className="w-full h-full object-contain"
            loading="eager"
          />
        ) : (
          <span role="alert" className="text-sm text-slate-600 text-center">
            {t(
              "图片加载失败，可重试或跳过本题",
              "Image unavailable. Retry or skip this item.",
              "Gambar tidak tersedia. Coba lagi atau lewati soal ini.",
            )}
          </span>
        )}
      </div>
      {asset && (
        <button
          ref={triggerRef}
          type="button"
          className="min-h-11 w-full rounded-lg text-sm text-primary-700 underline focus-visible:outline-2 focus-visible:outline-primary-600"
          aria-label={
            imgError
              ? t(
                  `重新加载：${imageLabel}`,
                  `Reload: ${imageLabel}`,
                  `Muat ulang: ${imageLabel}`,
                )
              : t(
                  `放大：${imageLabel}`,
                  `Enlarge: ${imageLabel}`,
                  `Perbesar: ${imageLabel}`,
                )
          }
          onClick={() => {
            if (imgError) {
              setRetry((n) => n + 1);
              setImgError(false);
            } else setExpanded(true);
          }}
        >
          {imgError
            ? t("重新加载图片", "Reload image", "Muat ulang gambar")
            : t("放大查看", "Enlarge image", "Perbesar gambar")}
        </button>
      )}
      {expanded &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-label={imageLabel}
            className="m-auto w-[96vw] max-w-4xl max-h-[94dvh] rounded-2xl border border-slate-300 bg-white p-3 text-slate-900 shadow-xl backdrop:bg-slate-900/70"
            onCancel={(e) => {
              e.preventDefault();
              setExpanded(false);
            }}
            onClose={() => setExpanded(false)}
            onClick={(e) => {
              if (e.target === e.currentTarget) setExpanded(false);
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold">{imageLabel}</span>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  aria-pressed={zoomed}
                  className="min-h-11 rounded-lg border px-3"
                  onClick={() => setZoomed((v) => !v)}
                >
                  {zoomed ? "100%" : "200%"}
                </button>
                <button
                  type="button"
                  ref={closeRef}
                  className="min-h-11 rounded-lg border px-3"
                  onClick={() => setExpanded(false)}
                >
                  {t("关闭", "Close", "Tutup")}
                </button>
              </div>
            </div>
            <div
              className="max-h-[76dvh] overflow-auto overscroll-contain rounded-lg border bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={source}
                alt={imageLabel}
                onError={failed}
                style={{ width: zoomed ? "200%" : "100%", maxWidth: "none" }}
                className="h-auto"
              />
            </div>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
