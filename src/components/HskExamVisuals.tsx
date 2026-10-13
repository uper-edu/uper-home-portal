import React, { useEffect, useState } from "react";
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
/** Only the archived PDF crop is shown. The whole option remains a single choice. */
export function HskExamImage({
  id,
  className = "w-full h-32 sm:h-40",
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
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setFailed(false);
    setRetry(0);
  }, [asset?.src]);
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  return (
    <div
      className={`${className} min-w-0 flex items-center justify-center bg-white overflow-hidden rounded-lg`}
    >
      {asset && !failed ? (
        <img
          src={asset.src + (retry ? `?hskRetry=${retry}` : "")}
          alt={label || t("PDF题图", "PDF question image", "Gambar soal PDF")}
          className="w-full h-full object-contain"
          onError={() => {
            setFailed(true);
            onUnavailable?.();
          }}
        />
      ) : (
        <span role="alert" className="text-sm text-center">
          {t("图片未能加载", "Image unavailable", "Gambar tidak tersedia")}
          {asset && (
            <button
              type="button"
              className="block min-h-11 underline mx-auto"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRetry((n) => n + 1);
                setFailed(false);
              }}
            >
              {t("重新加载图片", "Reload image", "Muat ulang gambar")}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
