import type {WaitlistState} from './enrollmentInterestRecords';
import {enrollmentCopy} from './enrollmentCatalog';

export type InterestLanguage = Parameters<typeof enrollmentCopy>[0];
export const interestText = enrollmentCopy;

const words:Record<string,readonly [string,string,string]> = {
  'weekday-day':['工作日白天','Weekday daytime','Siang hari kerja'],
  'weekday-evening':['工作日晚间','Weekday evening','Malam hari kerja'],
  mixed:['工作日与周末','Weekdays & weekends','Hari kerja & akhir pekan'],
  weekend:['周末','Weekend','Akhir pekan'],
  standard:['标准班','Standard class','Kelas standar'],
  small:['小班','Small group','Kelompok kecil'],
  'one-on-one':['一对一','One-to-one','Satu lawan satu'],
  unsure:['不确定我的级别','Not sure about my level','Belum yakin level saya'],
  any:['不限','Any','Bebas'],
  other:['其他','Other','Lainnya'],
};

export function interestOption(language:InterestLanguage,value:string) {
  return Object.hasOwn(words,value) ? interestText(language,words[value]) : value;
}

type Copy = readonly [string,string,string];

export const waitlistStates:Record<WaitlistState,Copy>={
  waiting:['候补中','On waitlist','Dalam daftar tunggu'],
  converted:['已转申请','Converted to an application','Menjadi pendaftaran'],
  withdrawn:['已取消候补','Waitlist entry cancelled','Daftar tunggu dibatalkan'],
  closed:['候补已结束','Waitlist closed','Daftar tunggu ditutup'],
};
