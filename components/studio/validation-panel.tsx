import type { Diagnostic, Workflow } from "@/lib/careflow";

export function ValidationPanel({ diagnostics, workflow, onSelectDiagnostic }: { diagnostics: Diagnostic[]; workflow: Workflow | null; onSelectDiagnostic?:(diagnostic:Diagnostic)=>void }) {
  const errors=diagnostics.filter((d)=>d.severity==="error");
  const warnings=diagnostics.filter((d)=>d.severity==="warning");
  return <div className="panel overflow-hidden"><div className="border-b border-[#dce5e2] px-4 py-3"><div className="flex items-center justify-between"><b className="text-sm">Safety linter</b><span className="text-[11px] font-bold text-[#71807c]">LIVE VALIDATOR</span></div><p className="mt-1 text-xs text-[#71807c]">CareFlow validates workflow logic before simulation.</p></div><div className="space-y-2 p-3">
    {workflow&&<><Check text={`${workflow.monitors.length} monitored variable${workflow.monitors.length===1?"":"s"} declared`} /><Check text={`${workflow.rules.length} rule${workflow.rules.length===1?"":"s"} parsed`} /></>}
    {diagnostics.map((d,index)=><button type="button" onClick={()=>onSelectDiagnostic?.(d)} key={`${d.code}-${index}`} className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${d.severity==="error"?"border-[#ecc4c4] bg-[#fff5f5] hover:border-[#d98d8d]":"border-[#ead8a9] bg-[#fffaf0] hover:border-[#d1ad55]"}`}><div className="flex gap-2"><span className={`font-bold ${d.severity==="error"?"text-[#b53b3b]":"text-[#a76509]"}`}>{d.severity==="error"?"✕":"⚠"}</span><div><div className="text-[10px] font-extrabold uppercase tracking-wider text-[#71807c]">{d.severity} · {d.code.replaceAll("_"," ")}</div><p className="mt-1 text-xs leading-5 text-[#384844]">{d.message}</p><span className="mt-1 block font-mono text-[10px] text-[#84938f]">Line {d.loc.line}, column {d.loc.column} · click to inspect</span></div></div></button>)}
    {!workflow&&diagnostics.length===0&&<p className="px-2 py-4 text-center text-xs text-[#84938f]">Compile source to inspect workflow safety.</p>}
    {workflow&&errors.length===0&&warnings.length===0&&<div className="rounded-lg border border-[#b9dfd7] bg-[#f0faf8] px-3 py-3 text-xs font-semibold text-[#076a60]">✓ No semantic warnings or errors</div>}
  </div></div>;
}
function Check({text}:{text:string}){return <div className="flex items-center gap-2 rounded-lg bg-[#f5f9f8] px-3 py-2 text-xs text-[#42534f]"><span className="font-bold text-[#087f72]">✓</span>{text}</div>;}
