import React from 'react';
import { ShieldCheck, ArrowLeft, Database } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudioPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-6">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Database className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Sanity Studio 已本地化迁移</h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          全站所有业务数据（合作院校、新闻资讯、项目列表、案例等）已成功固化并完成本地高性能解耦，无需依赖外部 Sanity 平台。
        </p>
        <div className="bg-slate-900/60 rounded-xl p-4 text-xs text-left text-slate-400 font-mono mb-6 space-y-1.5 border border-slate-700/50">
          <div className="text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>数据源: Local In-Memory JSON (Zero Latency)</span>
          </div>
          <div>文件目录: src/data/content/*.json</div>
          <div>状态: 100% 完整脱机与自给受控</div>
        </div>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-primary-600/20"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回官网首页</span>
        </Link>
      </div>
    </div>
  );
}
