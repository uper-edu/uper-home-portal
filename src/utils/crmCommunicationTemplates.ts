import { greeting } from "./crmContact";
import type { CrmLanguage } from "./crmLanguage";

/** Editable starting points, not confirmed commercial offers or automatic actions. */
export const communicationTemplates = [

  {
    id: "introduction",
    label: [
      "Introduction and needs",
      "Perkenalan dan kebutuhan",
      "初次联系与需求确认",
    ],
  },
  {id:"fees",label:["Discuss fees","Bahas biaya","学费咨询沟通"]},
  {
    id: "assessment",
    label: [
      "Discuss assessment results",
      "Bahas hasil asesmen",
      "测评结果沟通",
    ],
  },
  {
    id: "course",
    label: [
      "Course and schedule inquiry",
      "Informasi kelas dan jadwal",
      "课程与排期沟通",
    ],
  },
  {
    id: "trial",
    label: [
      "Trial lesson inquiry",
      "Permintaan kelas percobaan",
      "试听需求沟通",
    ],
  },
  {
    id: "enrollment",
    label: ["Enrollment assistance", "Bantuan pendaftaran kelas", "报名协助"],
  },
] as const;
export type CommunicationTemplateId =
  (typeof communicationTemplates)[number]["id"];
export function templateLabel(
  template: (typeof communicationTemplates)[number],
  lang: CrmLanguage,
) {
  return template.label[lang === "zh" ? 2 : lang === "id" ? 1 : 0];
}
export function communicationTemplate(
  id: string,
  language: string,
  name: string,
  advisor: string,
) {
  if (!["en", "id", "zh"].includes(language)) return "";
  if (id === "introduction") return greeting(language, name, advisor);
  const content: Record<string, Record<string, string>> = {
    fees:{
      en:`Hello ${name}! I'm ${advisor} from UPER Education. Which course would you like to know the fees for? I can check the current course fees, payment options and any applicable offer conditions with you.`,
      id:`Halo ${name}! Saya ${advisor} dari UPER Education. Biaya kursus apa yang ingin Anda ketahui? Saya dapat memeriksa biaya terkini, pilihan pembayaran, dan syarat penawaran yang berlaku bersama Anda.`,
      zh:`您好，${name}！我是 UPER Education 的 ${advisor}。您希望了解哪门课程的费用？我可以与您一起核实当前学费、付款方式及适用的优惠条件。`,
    },
    assessment: {
      en: `Hello ${name}! I'm ${advisor} from UPER Education. Would you like to discuss your assessment results and which learning goals matter most to you?`,
      id: `Halo ${name}! Saya ${advisor} dari UPER Education. Apakah Anda ingin membahas hasil asesmen dan tujuan belajar yang paling penting bagi Anda?`,
      zh: `您好，${name}！我是 UPER Education 的 ${advisor}。您是否方便聊聊测评结果，以及您最希望达成的学习目标？`,
    },
    course: {
      en: `Hello ${name}! I'm ${advisor} from UPER Education. Which class format and days or times would suit you? I can check the relevant course details, schedule and listed fees for you.`,
      id: `Halo ${name}! Saya ${advisor} dari UPER Education. Format kelas serta hari atau jam apa yang sesuai untuk Anda? Saya dapat memeriksa informasi kursus, jadwal, dan biaya yang tercantum.`,
      zh: `您好，${name}！我是 UPER Education 的 ${advisor}。您倾向哪种授课方式、哪些上课时间？我可以据此核实课程、排期及已公布的费用。`,
    },
    trial: {
      en: `Hello ${name}! I'm ${advisor} from UPER Education. If you would like to try a lesson, please let me know your preferred format and time. I will check whether a suitable trial is available before confirming any arrangement.`,
      id: `Halo ${name}! Saya ${advisor} dari UPER Education. Jika Anda ingin mencoba kelas, mohon beri tahu format dan waktu pilihan Anda. Saya akan memeriksa ketersediaannya sebelum mengonfirmasi pengaturan kelas percobaan.`,
      zh: `您好，${name}！我是 UPER Education 的 ${advisor}。如果您希望了解试听，请告诉我偏好的授课方式和时间。我会先核实是否有合适的试听安排，再向您确认。`,
    },
    enrollment: {
      en: `Hello ${name}! I'm ${advisor} from UPER Education. Which course are you considering? I can check its enrollment requirements, listed fees and registration steps with you.`,
      id: `Halo ${name}! Saya ${advisor} dari UPER Education. Kursus apa yang sedang Anda pertimbangkan? Saya dapat memeriksa persyaratan, biaya yang tercantum, dan langkah pendaftarannya bersama Anda.`,
      zh: `您好，${name}！我是 UPER Education 的 ${advisor}。您正在考虑哪门课程？我可以与您一起核实报名条件、已公布的费用和办理步骤。`,
    },
  };
  return content[id]?.[language] || "";
}
