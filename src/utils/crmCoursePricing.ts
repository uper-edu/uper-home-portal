import {paymentAmount} from './crmPayments';
export type CoursePrice={id:string;revision:number;name:string;sessions:number;price:number;active:boolean;maxDiscountBps:number;maxDiscountAmount:number|null};
export type EnrollmentQuote={courseId:string;courseRevision:number;discountMode:'none'|'amount'|'percent';discountValue:string;confirmed:boolean};
export function courseDiscount(course:CoursePrice,mode:string,value:unknown){
 const n=mode==='none'?0:mode==='amount'?paymentAmount(value,true):typeof value==='string'&&/^\d{1,3}(\.\d{1,2})?$/.test(value)?Number(value):NaN;
 if(!Number.isFinite(n)||n<0||mode==='percent'&&n>100||!['none','amount','percent'].includes(mode))throw Error('course_discount_invalid');
 const bps=mode==='percent'?Math.round(n*100):0;
 const amount=mode==='percent'?Math.floor(course.price*bps/10000):n;
 const limit=Math.min(Math.floor(course.price*course.maxDiscountBps/10000),course.maxDiscountAmount??course.price);
 if(amount>limit||amount>course.price||course.price>0&&amount===course.price)throw Error('course_discount_exceeded');
 return {discountAmount:amount,finalAmount:course.price-amount};
}
export function enrollmentQuoteError(q:any){return !q?.courseId||!Number.isInteger(q.courseRevision)?'course_required':q.confirmed!==true?'course_total_confirmation_required':'';}
export const courseError=(code:string,lang:string)=>({course_required:['Select a published course.','Pilih kursus yang diterbitkan.','请选择已发布课程。'],course_total_confirmation_required:['Confirm the final amount due.','Konfirmasi tagihan akhir.','请确认最终应收金额。'],course_discount_invalid:['Enter a valid discount.','Masukkan diskon yang valid.','请输入有效优惠。'],course_discount_exceeded:['Discount exceeds your allowance. Contact the pricing administrator.','Diskon melebihi batas. Hubungi pengelola harga.','优惠超过授权范围，请联系报价管理员。'],course_changed:['Course price or policy changed. Refresh and review before saving.','Harga atau aturan kursus berubah. Segarkan dan periksa.','课程价格或优惠规则已变化，请刷新核对后保存。'],course_unavailable:['Course is not available for new enrollment.','Kursus tidak tersedia untuk pendaftaran baru.','课程未发布或已停用，不能用于新报名。'],course_conflict:['Course changed. Draft retained; refresh and review.','Kursus berubah. Draf disimpan; segarkan dan periksa.','课程已被更新，草稿保留，请刷新核对。'],course_information_invalid:['Check the course fields.','Periksa informasi kursus.','请核对课程资料。'],enrollment_exists:['This customer already has an enrollment project. Repeat enrollment is not supported yet.','Pelanggan sudah memiliki proyek pendaftaran. Pendaftaran ulang belum didukung.','当前客户已有报名项目，暂不支持再次报名。'],course_forbidden:['You do not have permission for this action.','Anda tidak memiliki izin untuk tindakan ini.','你无权执行此操作。']} as Record<string,string[]>)[code]?.[lang==='zh'?2:lang==='id'?1:0]||code;
/** A never-published draft must not change existing consultation prices. Retired published courses stay retired. */
export function publishedCourseBook(rows:any[]){
 const activated=rows.some(r=>r.value.active||(r.value.history||[]).some((h:any)=>h.before?.active||h.after?.active));
 if(!activated)return undefined;
 return {currency:'IDR',courses:rows.filter(r=>r.value.active).map(r=>({id:r.value.name,sessions:r.value.sessions,total:r.value.price}))};
}
