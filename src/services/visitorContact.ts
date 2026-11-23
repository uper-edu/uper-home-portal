import {visitorScope} from './visitorScope';

export type VisitorContact = Partial<{fullName:string;email:string;whatsapp:string}>;
const lifetime = 24 * 60 * 60 * 1000;
const contactKey = 'uper_visitor_contact';
const formKey = 'uper_enrollment_draft';
const changed='uper_visitor_contact_changed';

function read<T>(where:'localStorage'|'sessionStorage',key:string,owner:string):T|undefined {
  if (!owner || owner!==visitorScope()) return;
  try {
    const storage=window[where], scoped=key+':'+owner;
    const saved=JSON.parse(storage.getItem(scoped)??'null') as {value:T;expiresAt:number}|null;
    if (saved && saved.expiresAt>Date.now()) return saved.value;
    if (saved) storage.removeItem(scoped);
  } catch { /* Form use remains available without browser storage. */ }
}

function write<T>(where:'localStorage'|'sessionStorage',key:string,owner:string,value?:T) {
  if (!owner || owner!==visitorScope()) return;
  try {
    const storage=window[where], scoped=key+':'+owner;
    if (value===undefined) storage.removeItem(scoped);
    else storage.setItem(scoped,JSON.stringify({value,expiresAt:Date.now()+lifetime}));
  } catch { /* Keep the current form in memory. */ }
}

export function readVisitorContact(owner:string):VisitorContact|undefined {
  return read('localStorage',contactKey,owner);
}

export function writeVisitorContact(owner:string,contact:VisitorContact) {
  write('localStorage',contactKey,owner,contact);
  if(owner&&owner===visitorScope())window.dispatchEvent(new Event(changed));
}

export function readEnrollmentDraft<T>(owner:string,form:string) {
  return read<T>('sessionStorage',formKey+':'+form,owner);
}

export function writeEnrollmentDraft<T>(owner:string,form:string,value?:T) {
  write('sessionStorage',formKey+':'+form,owner,value);
}

export function subscribeVisitorContact(owner:string,listener:(contact:VisitorContact)=>void) {
  const update=()=>{
    const value=readVisitorContact(owner);
    if(value)listener(value);
  };
  const storage=(event:StorageEvent)=>{
    if(event.key===contactKey+':'+owner)update();
  };
  window.addEventListener(changed,update);
  window.addEventListener('storage',storage);
  return ()=>{
    window.removeEventListener(changed,update);
    window.removeEventListener('storage',storage);
  };
}
