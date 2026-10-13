import React from "react";
import type { LeadProfile } from "../types/leadSystem";
import { chooseText, type HskLanguage } from "../data/hskAssessment";
import { localizedStudentField } from "../services/hskWhatsApp";

export default function HskAssessmentWelcome({
  profile,
  lang,
  completed = true,
}: {
  profile: Partial<LeadProfile> | null;
  lang: HskLanguage;
  completed?: boolean;
}) {
  const t = (zh: string, en: string, id: string) =>
    chooseText(lang, zh, en, id);
  return (
    <section
      aria-label={t("测评后问候", "Assessment welcome", "Sapaan setelah tes")}
      data-hsk-welcome
      className="space-y-2 text-sm scroll-mt-4"
    >
      <p>
        {t("您好，", "Hello, ", "Halo, ")}
        <strong>
          {profile?.fullName || t("欢迎", "welcome", "selamat datang")}
        </strong>
        {t(
          "！欢迎来到 UPER 学习咨询。",
          "! Welcome to your UPER learning consultation.",
          "! Selamat datang di konsultasi belajar UPER.",
        )}
      </p>
      <dl className="space-y-1">
        {profile?.goal && (
          <div>
            <dt className="inline font-semibold">
              {t("学习目标：", "Learning goal: ", "Tujuan belajar: ")}
            </dt>
            <dd className="inline">
              {localizedStudentField(profile.goal, lang)}
            </dd>
          </div>
        )}
        {profile?.reportedLevel && (
          <div>
            <dt className="inline font-semibold">
              {t(
                "填写时的基础（自报）：",
                "Starting level you reported: ",
                "Tingkat awal yang Anda laporkan: ",
              )}
            </dt>
            <dd className="inline">
              {localizedStudentField(profile.reportedLevel, lang)}
            </dd>
          </div>
        )}
      </dl>
      <p>
        {completed ? t(
          "测评已完成，下面是您的结果与学习建议。",
          "Your assessment is complete. Here are your results and learning guidance.",
          "Tes Anda telah selesai. Berikut hasil dan panduan belajar Anda.",
        ) : t('我们可以先根据您的学习目标提供课程咨询。','Let’s discuss suitable courses based on your learning goal.','Mari membahas kursus yang sesuai dengan tujuan belajar Anda.')}
      </p>
    </section>
  );
}
