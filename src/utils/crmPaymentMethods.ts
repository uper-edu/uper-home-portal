import type {PaymentEntry} from './crmPayments';
export type PaymentMethod='bank_transfer'|'qris'|'ewallet'|'virtual_account'|'card'|'cash'|'other';
type Text=readonly [string,string,string];
export const paymentText=(v:Text,lang:string)=>v[lang==='zh'?0:lang==='id'?2:1];
export const paymentMethods:Record<PaymentMethod,{label:Text;provider?:Text;providerRequired?:boolean;account:Text;reference:Text}>={
 bank_transfer:{label:['银行转账','Bank transfer','Transfer bank'],provider:['收款银行','Receiving bank','Bank penerima'],providerRequired:true,account:['公司收款账号','Company receiving account','Rekening penerima perusahaan'],reference:['银行交易编号','Bank transaction reference','Nomor transaksi bank']},
 qris:{label:['QRIS扫码','QRIS','QRIS'],provider:['收款银行／平台','Receiving bank / platform','Bank / platform penerima'],account:['收款商户名称／编号','Receiving merchant name / ID','Nama / ID merchant penerima'],reference:['QRIS交易编号','QRIS transaction ID','Nomor transaksi QRIS']},
 ewallet:{label:['电子钱包','E-wallet','Dompet digital'],provider:['收款钱包','Receiving wallet','Dompet penerima'],providerRequired:true,account:['公司钱包账号','Company wallet account','Akun dompet perusahaan'],reference:['钱包交易编号','Wallet transaction ID','Nomor transaksi dompet']},
 virtual_account:{label:['虚拟账户（VA）','Virtual account (VA)','Virtual account (VA)'],provider:['收款银行','Receiving bank','Bank penerima'],providerRequired:true,account:['虚拟账户号码','Virtual account number','Nomor virtual account'],reference:['付款交易编号','Payment transaction ID','Nomor transaksi pembayaran']},
 card:{label:['银行卡支付','Card payment','Kartu debit / kredit'],provider:['收款机构／平台','Payment processor','Penyedia pembayaran'],providerRequired:true,account:['商户账号／编号','Merchant account / ID','Akun / ID merchant'],reference:['支付交易编号','Payment transaction ID','Nomor transaksi pembayaran']},
 cash:{label:['现金','Cash','Tunai'],account:['收款人','Cash recipient','Penerima tunai'],reference:['收据／财务凭证编号','Receipt / voucher number','Nomor kuitansi / bukti kas']},
 other:{label:['其他','Other','Lainnya'],provider:['收款机构','Receiving institution','Lembaga penerima'],account:['收款方','Recipient','Penerima'],reference:['交易／凭证编号','Transaction / voucher reference','Nomor transaksi / bukti']},
};
export const isPaymentMethod=(v:unknown):v is PaymentMethod=>typeof v==='string'&&Object.hasOwn(paymentMethods,v);
/** For receipts account means the company's receiving account; for refunds it means the destination. */
export function paymentMethodFields(method:PaymentMethod,refund=false){
 const spec=paymentMethods[method];if(!refund)return spec;
 const destinations:Record<PaymentMethod,{provider?:Text;account:Text;reference:Text}>={
  bank_transfer:{provider:['退款去向银行','Refund destination bank','Bank tujuan pengembalian'],account:['退款去向账户','Refund destination account','Rekening tujuan pengembalian'],reference:['退款交易编号','Refund transaction reference','Nomor transaksi pengembalian']},
  qris:{provider:['退款平台','Refund platform','Platform pengembalian'],account:['退款去向／接收人','Refund destination / recipient','Tujuan / penerima pengembalian'],reference:['退款交易编号','Refund transaction reference','Nomor transaksi pengembalian']},
  ewallet:{provider:['退款去向钱包','Refund destination wallet','Dompet tujuan pengembalian'],account:['退款去向钱包账号','Refund destination wallet account','Akun dompet tujuan pengembalian'],reference:['退款交易编号','Refund transaction reference','Nomor transaksi pengembalian']},
  virtual_account:{provider:['退款去向银行','Refund destination bank','Bank tujuan pengembalian'],account:['退款去向账户','Refund destination account','Rekening tujuan pengembalian'],reference:['退款交易编号','Refund transaction reference','Nomor transaksi pengembalian']},
  card:{provider:['退款机构／平台','Refund processor','Penyedia pengembalian'],account:['退款去向卡号尾号／接收人','Refund card last digits / recipient','Digit akhir kartu / penerima pengembalian'],reference:['退款交易编号','Refund transaction reference','Nomor transaksi pengembalian']},
  cash:{account:['退款接收人','Refund recipient','Penerima pengembalian'],reference:['退款收据／凭证编号','Refund receipt / voucher number','Nomor kuitansi / bukti pengembalian']},
  other:{provider:['退款机构','Refund institution','Lembaga pengembalian'],account:['退款去向／接收人','Refund destination / recipient','Tujuan / penerima pengembalian'],reference:['退款交易／凭证编号','Refund transaction / voucher reference','Nomor transaksi / bukti pengembalian']},
 };
 return {...spec,...destinations[method]};
}
const banks=['BCA','Mandiri','BNI','BRI','Permata','CIMB Niaga','BSI','Danamon'];
const wallets=['GoPay','OVO','DANA','ShopeePay','LinkAja'];
export const paymentProviders=(method:string)=>['bank_transfer','virtual_account'].includes(method)?banks:method==='ewallet'?wallets:[];
export const paymentMethodLabel=(entry:Pick<PaymentEntry,'method'|'methodName'>,lang:string)=>isPaymentMethod(entry.method)?entry.method==='other'&&entry.methodName?entry.methodName:paymentText(paymentMethods[entry.method].label,lang):entry.method;
export function paymentExceptionNoteRequired(action:string,amount:number,remaining:number|null,entry?:PaymentEntry,details?:{account?:string;reference?:string;provider?:string}){
 if(action==='reject'||action==='void')return true;
 if(action==='refund')return true;
 if(!['receive','verify'].includes(action))return false;
 if(entry?.kind==='refund'||entry&&amount!==entry.amount||remaining!==null&&(!entry||entry.kind==='receipt')&&amount>remaining)return true;
 return !!(entry&&details&&(['account','reference','provider']as const).some(k=>!!entry[k]&&details[k]!==undefined&&entry[k]!==details[k]));
}
export type PaymentImageUpload={name:string;type:string;data:string};
export type PaymentImage={id:string;name:string;mime:string;bytes:number;sha256:string};
export const MAX_PAYMENT_IMAGE_BYTES=5*1024*1024;
export const MAX_PAYMENT_IMAGE_TOTAL=9*1024*1024;
export const MAX_PAYMENT_IMAGES=3;
export const paymentImageTypes=['image/jpeg','image/png','image/webp'];
