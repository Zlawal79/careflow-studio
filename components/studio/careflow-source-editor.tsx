"use client";

import { forwardRef, useState } from "react";

interface SourceEditorProps { value:string; onChange:(value:string)=>void; state:"valid"|"warning"|"error"|"dirty"; }

export const CareFlowSourceEditor=forwardRef<HTMLTextAreaElement,SourceEditorProps>(function CareFlowSourceEditor({value,onChange,state},ref){
  const [scroll,setScroll]=useState({top:0,left:0});
  const lines=value.split("\n");
  const border=state==="error"?"ring-2 ring-inset ring-[#c94b4b]":state==="warning"?"ring-2 ring-inset ring-[#d7942d]":state==="valid"?"ring-2 ring-inset ring-[#238f7d]":"";
  return <div className={`relative h-[640px] overflow-hidden bg-[#13201e] ${border}`}>
    <div className="absolute inset-y-0 left-0 z-20 w-14 overflow-hidden border-r border-white/10 bg-[#101a18]" aria-hidden="true"><div className="flex flex-col items-end py-4 pr-3 font-mono text-xs leading-6 text-[#607a74]" style={{transform:`translateY(-${scroll.top}px)`}}>{lines.map((_,index)=><span key={index} className="h-6">{index+1}</span>)}</div></div>
    <pre aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 m-0 overflow-hidden py-4 pl-[70px] pr-4 font-mono text-[13px] leading-6" style={{transform:`translate(${-scroll.left}px, ${-scroll.top}px)`,whiteSpace:"pre"}}><HighlightedSource source={value}/></pre>
    <textarea ref={ref} aria-label="CareFlow source" spellCheck={false} value={value} onChange={(event)=>onChange(event.target.value)} onScroll={(event)=>setScroll({top:event.currentTarget.scrollTop,left:event.currentTarget.scrollLeft})} className="code-scroll absolute inset-0 z-10 h-full w-full resize-none overflow-auto bg-transparent py-4 pl-[70px] pr-4 font-mono text-[13px] leading-6 text-transparent outline-none selection:bg-[#315e57]" style={{caretColor:"#d7e7e3",WebkitTextFillColor:"transparent",whiteSpace:"pre"}}/>
  </div>;
});

function HighlightedSource({source}:{source:string}){
  const pattern=/(\/\/[^\n]*|\b(?:workflow|monitor|rule|when|for|then|alert|priority|escalate|require|acknowledgment|acknowledgement|within|otherwise)\b|<=|>=|==|!=|[<>{}]|-?\d+(?:\.\d+)?|\b(?:low|medium|high|critical|seconds?|minutes?|hours?)\b)/g;
  const parts=source.split(pattern);
  return <>{parts.map((part,index)=>{let className="text-[#d7e7e3]";if(part.startsWith("//"))className="text-[#718c85] italic";else if(/^(workflow|monitor|rule|when|for|then|alert|priority|escalate|require|acknowledgment|acknowledgement|within|otherwise)$/.test(part))className="font-semibold text-[#77d8c5]";else if(/^(low|medium|high|critical|seconds?|minutes?|hours?)$/.test(part))className="text-[#e9c56b]";else if(/^-?\d/.test(part))className="text-[#8cb9e3]";else if(/^(<=|>=|==|!=|[<>{}])$/.test(part))className="text-[#d99d78]";return <span key={index} className={className}>{part}</span>;})}</>;
}
