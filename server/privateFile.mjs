// Windows PowerShell 5.1 exposes the .NET Framework file-handle ACL APIs. Keep its program
// constant: filenames and payloads are data on stdin, never command-line arguments or logs.
import {spawnSync} from 'node:child_process';
import {constants,closeSync,fstatSync,lstatSync,openSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const privateFileProgram=String.raw`
$ErrorActionPreference='Stop'
try {
  $request=ConvertFrom-Json ([Console]::In.ReadToEnd())
  $path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($request.path))
  $user=[Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($request.op -eq 'create') {
    $acl=[Security.AccessControl.FileSecurity]::new()
    $acl.SetOwner($user)
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($user,'FullControl','Allow'))
    $stream=[IO.FileStream]::new($path,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::FullControl,[IO.FileShare]::None,4096,[IO.FileOptions]::None,$acl)
    try {
      $bytes=[Convert]::FromBase64String($request.content)
      $stream.Write($bytes,0,$bytes.Length)
    } finally {$stream.Dispose()}
  } else {
    $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try {
      if (([IO.File]::GetAttributes($path) -band [IO.FileAttributes]::ReparsePoint) -or $stream.Length -gt 65536) {exit 2}
      $acl=$stream.GetAccessControl()
      $raw=[Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(),0)
      $trusted=@($user.Value,'S-1-5-18','S-1-5-32-544')
      if ($null -eq $raw.DiscretionaryAcl -or $trusted -notcontains $raw.Owner.Value) {exit 2}
      foreach ($ace in $raw.DiscretionaryAcl) {
        if ($ace.AceType -eq [Security.AccessControl.AceType]::AccessDenied) {continue}
        if ($ace.AceType -ne [Security.AccessControl.AceType]::AccessAllowed -or $trusted -notcontains $ace.SecurityIdentifier.Value) {exit 2}
      }
      $memory=[IO.MemoryStream]::new()
      try {$stream.CopyTo($memory); [Console]::Out.Write([Convert]::ToBase64String($memory.ToArray()))} finally {$memory.Dispose()}
    } finally {$stream.Dispose()}
  }
} catch {exit 2}
`;
const encoded=Buffer.from(privateFileProgram,'utf16le').toString('base64');
function windowsFile(file,op,content,reason){
  // Private local files only; don't open devices, streams or network shares.
  if (!/^[A-Za-z]:[\\/]/.test(file)||file.slice(2).includes(':')) throw Error(reason);
  if(op==='read'&&!lstatSync(file).isFile())throw Error(reason);
  const binary=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const result=spawnSync(binary,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',encoded],{
    windowsHide:true,encoding:'utf8',timeout:15_000,maxBuffer:256*1024,
    input:JSON.stringify({op,path:Buffer.from(file,'utf8').toString('base64'),content}),
  });
  if(result.status!==0||result.error)throw Error(reason);
  return Buffer.from(result.stdout,'base64');
}

export function readPrivateFile(file,reason='Private owner permissions required'){
  if(process.platform==='win32')return windowsFile(file,'read',undefined,reason);
  const fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size>65536||(stat.mode&0o177))throw Error(reason);
    return readFileSync(fd);
  }finally{closeSync(fd);}
}

/** Set the private permissions when creating the file; never overwrite an existing file. */
export function createPrivateFile(file,content){
  if(process.platform==='win32')windowsFile(file,'create',Buffer.from(content).toString('base64'),'Could not create private file');
  else writeFileSync(file,content,{flag:'wx',mode:0o600});
}
