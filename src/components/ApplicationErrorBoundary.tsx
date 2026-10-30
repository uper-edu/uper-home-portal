import React from 'react';
import {applyPageMetadata} from './PageMetadata';
import {normalizeSiteLanguage,resolveMetadata} from '../utils/siteMetadata';
import {classifyClientFailure,clientFailureText} from '../utils/clientDiagnostics';
import {reportClientFailure} from '../services/clientDiagnostics';
export function ApplicationErrorNotice({error,reference='',language,reload=()=>window.location.reload()}: {error:unknown;reference?:string;language:string;reload?:()=>void}) {
  const text=clientFailureText(classifyClientFailure(error),language);
  return <main translate="no" className="notranslate min-h-screen flex items-center justify-center p-6 bg-slate-50 text-[var(--admin-text)] font-sans">
    <section role="alert" aria-labelledby="application-error-title" className="max-w-md w-full bg-[var(--admin-surface)] p-6 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4">
      <div aria-hidden="true" className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold text-[var(--admin-danger)] bg-[var(--admin-danger-bg)]">!</div>
      <h1 id="application-error-title" className="text-lg font-bold">{text.title}</h1>
      <p className="text-sm text-[var(--admin-muted)]">{text.description}</p>
      <p className="text-xs text-[var(--admin-muted)]">{text.warning}</p>
      {reference&&<p className="text-xs break-all text-[var(--admin-muted)]">{text.reference}：{reference}</p>}
      <button onClick={()=>{if(window.confirm(text.confirm))reload();}} className="w-full py-2.5 px-4 bg-[var(--admin-action-fill)] text-[var(--admin-on-action)] font-medium text-sm rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus)]">{text.reload}</button>
    </section>
  </main>;
}
export default class ApplicationErrorBoundary extends React.Component<{children:React.ReactNode},{error:Error|null;reference:string}> {
  state={error:null as Error|null,reference:''};
  static getDerivedStateFromError(error:Error){return {error};}
  componentDidCatch(error:Error,info:React.ErrorInfo){
    const reference=reportClientFailure(error,'react',info.componentStack||'');
    this.setState({reference});
    applyPageMetadata(document,resolveMetadata(window.location.pathname,normalizeSiteLanguage(document.documentElement.lang),{unavailable:true}));
  }
  render(){return this.state.error?<ApplicationErrorNotice error={this.state.error} reference={this.state.reference} language={document.documentElement.lang||'en'}/>:this.props.children;}
}
