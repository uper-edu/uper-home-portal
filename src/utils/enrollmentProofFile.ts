const proofSignatures = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
} as const;

export const enrollmentProofAccept = Object.keys(proofSignatures).join(',');
export const maxEnrollmentProofBytes = 2 * 1024 * 1024;

export function enrollmentProofUploadTimeout(size: number, transport?: 'binary-v1') {
  const bytesPerSecond = 16_000; // Budget for a 128 kbit/s upload.
  const wireBytes = transport === 'binary-v1' ? size : 4 * Math.ceil(size / 3);
  // Include server and response time while keeping well inside a new five-minute reservation.
  return Math.max(90_000, Math.ceil(wireBytes * 1000 / bytesPerSecond) + 15_000);
}

function proofSizeIssue(size:number) {
  if (size > maxEnrollmentProofBytes) return 'too_large';
  if (size < 16) return 'invalid';
}

export function enrollmentProofFileIssue(size: number, mime: unknown) {
  return proofSizeIssue(size) ?? (
    typeof mime !== 'string' || !Object.hasOwn(proofSignatures, mime) ? 'invalid' : undefined
  );
}

const genericProofMime=(mime:string)=>!mime||mime==='application/octet-stream';

export function enrollmentProofSelectionIssue(file:Pick<File,'size'|'type'>) {
  return genericProofMime(file.type)?proofSizeIssue(file.size):enrollmentProofFileIssue(file.size,file.type);
}

export function matchesEnrollmentProofSignature(bytes: Uint8Array, mime: unknown) {
  if (typeof mime !== 'string' || !Object.hasOwn(proofSignatures, mime)) return false;
  return proofSignatures[mime as keyof typeof proofSignatures].every((value, index) => bytes[index] === value);
}

export async function prepareEnrollmentProofFile(file:File):Promise<File|undefined> {
  if(enrollmentProofSelectionIssue(file))return;
  const header=await file.slice(0,8).arrayBuffer().catch(()=>null);
  if(!header)return;
  const bytes=new Uint8Array(header);
  if(!genericProofMime(file.type))return matchesEnrollmentProofSignature(bytes,file.type)?file:undefined;
  const type=Object.keys(proofSignatures).find(mime=>matchesEnrollmentProofSignature(bytes,mime));
  if(type)return new File([file],file.name,{type,lastModified:file.lastModified});
}
