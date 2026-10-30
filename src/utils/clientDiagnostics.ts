/** Technical diagnostics only. Never include free-form messages, form values, URLs or query strings. */
export type ClientFailureKind = 'dom-interference' | 'module-load' | 'network' | 'runtime';
export type DiagnosticSource = 'react' | 'window' | 'promise' | 'preload';
export interface ClientDiagnostic {
  schema: 1; id: string; kind: ClientFailureKind; source: DiagnosticSource;
  errorName: string; route: string; buildId: string; frames: string[];
}
const kinds: ClientFailureKind[] = ['dom-interference','module-load','network','runtime'];
const sources: DiagnosticSource[] = ['react','window','promise','preload'];
const names = ['Error','TypeError','SyntaxError','ReferenceError','RangeError','NotFoundError','SecurityError','QuotaExceededError','ChunkLoadError','DOMException'];
const routes = ['/','/chat','/consult','/crm','/cms','/system','/faq','/hsk','/csca','/contact'];
export function classifyClientFailure(error: unknown, source: DiagnosticSource = 'react'): ClientFailureKind {
  const e = error as {name?: unknown; message?: unknown} | null;
  const message = typeof e?.message === 'string' ? e.message : typeof error === 'string' ? error : '';
  if (e?.name === 'NotFoundError' && /insertBefore|removeChild/.test(message)) return 'dom-interference';
  if (source === 'preload' || e?.name === 'ChunkLoadError' || /(?:failed to fetch dynamically imported module|importing a module script failed|failed to load module script|loading chunk .+ failed)/i.test(message)) return 'module-load';
  if (e?.name === 'TypeError' && /^(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed)$/i.test(message)) return 'network';
  return 'runtime';
}
export function diagnosticFrames(stack: unknown): string[] {
  if (typeof stack !== 'string') return [];
  // Only compiler-generated symbol names and JS/TS basenames + line/column. Never capture error messages.
  return stack.split('\n').filter(line => /^\s*at\s/.test(line)).slice(0,12).flatMap(line => {
    const location = line.match(/\/((?:[A-Za-z0-9_-]+)\.(?:m?js|tsx?)):(\d+):(\d+)/);
    if (location) return [`${location[1]}:${location[2]}:${location[3]}`];
    const symbol = line.match(/^\s*at\s+([A-Za-z_$][A-Za-z0-9_$.]{0,79})(?:\s|$|\()/);
    return symbol ? [symbol[1]] : [];
  }).slice(0,8);
}
export function sanitizeClientDiagnostic(input: unknown): ClientDiagnostic | null {
  if (!input || typeof input !== 'object') return null;
  const x = input as Record<string, unknown>;
  if (x.schema !== 1 || typeof x.id !== 'string' || !/^[a-f0-9-]{36}$/.test(x.id) || !kinds.includes(x.kind as ClientFailureKind) || !sources.includes(x.source as DiagnosticSource)) return null;
  return {
    schema:1,id:x.id,kind:x.kind as ClientFailureKind,source:x.source as DiagnosticSource,
    errorName: typeof x.errorName === 'string' && names.includes(x.errorName) ? x.errorName : 'Error',
    route: typeof x.route === 'string' && routes.includes(x.route) ? x.route : '/other',
    buildId: typeof x.buildId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(x.buildId) ? x.buildId : 'unknown',
    frames:Array.isArray(x.frames) ? x.frames.filter((s):s is string => typeof s==='string' && /^(?:[A-Za-z_$][A-Za-z0-9_$.]{0,79}|[A-Za-z0-9_-]+\.(?:m?js|tsx?):\d{1,8}:\d{1,8})$/.test(s)).slice(0,8) : [],
  };
}
export function clientFailureText(kind: ClientFailureKind, language: string) {
  const l=language.startsWith('zh')?0:language.startsWith('id')?2:1;
  const title={
    'dom-interference':['页面显示受到干扰','Page display was interrupted','Tampilan halaman terganggu'],
    'module-load':['页面资源加载失败','Page resources could not load','Sumber daya halaman gagal dimuat'],
    network:['网络连接暂不可用','Network connection unavailable','Koneksi jaringan tidak tersedia'],
    runtime:['页面暂时无法显示','This page cannot be displayed','Halaman tidak dapat ditampilkan'],
  }[kind][l];
  const description={
    'dom-interference':['浏览器翻译或扩展可能改动了页面。请关闭此页的浏览器翻译，并使用页面内的语言切换。','Browser translation or an extension may have changed the page. Turn off browser translation for this page and use its language controls.','Terjemahan browser atau ekstensi mungkin mengubah halaman. Nonaktifkan terjemahan browser untuk halaman ini dan gunakan pilihan bahasa di dalam halaman.'],
    'module-load':['页面资源未能加载，可能与网络或版本更新有关。','Page resources could not load, possibly due to a connection issue or an update.','Sumber daya halaman tidak dapat dimuat, mungkin karena masalah koneksi atau pembaruan.'],
    network:['请检查网络连接后再试。','Check your network connection before trying again.','Periksa koneksi jaringan sebelum mencoba lagi.'],
    runtime:['页面遇到运行异常。请记录下方错误编号，便于排查。','The page encountered an unexpected error. Keep the reference below for troubleshooting.','Halaman mengalami kesalahan. Simpan nomor referensi di bawah untuk pemeriksaan.'],
  }[kind][l];
  return {title,description,reload:['重新加载页面','Reload page','Muat ulang halaman'][l],reference:['错误编号','Error reference','Nomor referensi'][l],warning:['重新加载可能丢失未提交内容。若刚刚提交过，请先核对保存结果，避免重复提交。','Reloading may discard unsent entries. If you just submitted, check whether it was saved before submitting again.','Memuat ulang dapat menghapus isian yang belum dikirim. Jika baru mengirim, periksa apakah data tersimpan sebelum mengirim ulang.'][l],confirm:['重新加载会清除页面上尚未提交的填写内容，是否继续？','Reloading will discard unsent entries on this page. Continue?','Memuat ulang akan menghapus isian yang belum dikirim di halaman ini. Lanjutkan?'][l]};
}
