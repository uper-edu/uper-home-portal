import {visitorScope} from './visitorScope';

export type VisitorContact = Partial<{fullName:string;email:string;whatsapp:string}>;
const lifetime = 24 * 60 * 60 * 1000;
const contactKey = 'uper_visitor_contact';
const formKey = 'uper_enrollment_draft';
const changed='uper_visitor_contact_changed';
// A failed clear must also hide an older value which is still readable.
const temporaryEnrollmentDrafts = new Map<string,string|null>();

function read<T>(where:'localStorage'|'sessionStorage',key:string,owner:string):T|undefined {
  if (!owner || owner!==visitorScope()) return;
  const scoped=key+':'+owner;
  try {
    const temporary=where==='sessionStorage'?temporaryEnrollmentDrafts.get(scoped):undefined;
    const saved=JSON.parse((temporary===undefined?window[where].getItem(scoped):temporary)??'null') as {value:T;expiresAt:number}|null;
    if (saved && saved.expiresAt>Date.now()) return saved.value;
    if (saved) {
      if(temporary!==undefined)temporaryEnrollmentDrafts.set(scoped,null);
      else window[where].removeItem(scoped);
    }
  } catch { /* Form use remains available without browser storage. */ }
}

function write<T>(where:'localStorage'|'sessionStorage',key:string,owner:string,value?:T) {
  if (!owner || owner!==visitorScope()) return;
  const scoped=key+':'+owner;
  let encoded:string|null|undefined;
  try {
    encoded=value===undefined?null:JSON.stringify({value,expiresAt:Date.now()+lifetime});
    if (encoded===null) window[where].removeItem(scoped);
    else window[where].setItem(scoped,encoded);
    if(where==='sessionStorage')temporaryEnrollmentDrafts.delete(scoped);
  } catch {
    if(where==='sessionStorage'&&encoded!==undefined)temporaryEnrollmentDrafts.set(scoped,encoded);
  }
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
