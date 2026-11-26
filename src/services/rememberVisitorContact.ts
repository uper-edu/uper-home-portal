import {validContactEmail} from '../utils/contactEmail';
import {validContactPhone} from '../utils/contactPhone';
import {readVisitorContact,writeVisitorContact,type VisitorContact} from './visitorContact';

export function rememberVisitorContact(owner:string,fields:VisitorContact) {
  const email=fields.email?.trim().toLowerCase();
  const fullName=fields.fullName?.trim();
  const whatsapp=fields.whatsapp?.trim();
  if (!email || !validContactEmail(email)) return;
  const current=readVisitorContact(owner);
  const contact:VisitorContact=current?.email===email?{...current,email}:{email};
  if (fullName && fullName.length<=120) contact.fullName=fullName;
  if (whatsapp && validContactPhone(whatsapp)) contact.whatsapp=whatsapp;
  writeVisitorContact(owner,contact);
}
