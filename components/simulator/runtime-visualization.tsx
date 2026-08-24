"use client";

import type { SimulationEvent, SimulationResult, Workflow } from "@/lib/careflow";

export type MarkerKind =
  | "condition_true"
  | "timer_started"
  | "persistence_satisfied"
  | "rule_fired"
  | "alert_created"
  | "ack_window"
  | "acknowledged"
  | "deadline_missed"
  | "escalated";

export interface RuntimeMarker {
  id: string;
  timestamp: number;
  kind: MarkerKind;
  label: string;
  detail: string;
  event: SimulationEvent;
}

const markerMeta: Record<MarkerKind, { color:string; short:string }> = {
  condition_true:{color:"#d7942d",short:"Condition true"},
  timer_started:{color:"#b27b21",short:"Timer started"},
  persistence_satisfied:{color:"#087f72",short:"Duration met"},
  rule_fired:{color:"#2867a8",short:"Rule fired"},
  alert_created:{color:"#4967b0",short:"Alert created"},
  ack_window:{color:"#8b6b1c",short:"Ack window"},
  acknowledged:{color:"#16866f",short:"Acknowledged"},
  deadline_missed:{color:"#b95a32",short:"Deadline missed"},
  escalated:{color:"#b53b3b",short:"Escalated"},
};

/** Converts engine observations into display markers without evaluating DSL conditions. */
export function deriveRuntimeMarkers(events: readonly SimulationEvent[]): RuntimeMarker[] {
  const previousByRule=new Map<string,SimulationEvent>();
  const markers:RuntimeMarker[]=[];
  const add=(event:SimulationEvent,kind:MarkerKind,label:string,detail:string)=>markers.push({id:`${event.timestamp}-${event.ruleName}-${kind}-${markers.length}`,timestamp:event.timestamp,kind,label,detail,event});

  for(const event of events){
    const previous=previousByRule.get(event.ruleName);
    const becameTrue=(event.conditionStatus==="waiting"||event.conditionStatus==="satisfied")&&(!previous||previous.conditionStatus==="false"||previous.conditionStatus==="unknown");
    if(becameTrue){
      add(event,"condition_true",`${event.ruleName}: condition became true`,`The runtime reported ${event.conditionStatus} with observed value ${event.observedValue}.`);
      if(event.durationRequirement) add(event,"timer_started",`${event.ruleName}: persistence timer started`,`Elapsed 0 of ${formatDuration(event.durationRequirement.milliseconds)} required.`);
    }
    if(event.conditionStatus==="satisfied"&&event.durationRequirement&&previous?.conditionStatus!=="satisfied"){
      add(event,"persistence_satisfied",`${event.ruleName}: persistence requirement satisfied`,`${formatDuration(event.elapsedDurationMs)} elapsed; the runtime marked the condition satisfied.`);
    }
    const thenActions=event.actions.filter((action)=>action.reason==="then");
    if(thenActions.length){
      add(event,"rule_fired",`${event.ruleName} fired`,event.firingInstanceId?`Stable firing instance ${event.firingInstanceId}.`:"The runtime emitted rule actions.");
      for(const action of thenActions.filter((action)=>action.kind==="alert")) add(event,"alert_created",`Alert created for ${action.target}`,`${action.firingInstanceId} · emitted by the CareFlow interpreter.`);
    }
    if(event.acknowledgementStatus==="pending"&&previous?.acknowledgementStatus!=="pending") add(event,"ack_window",`Acknowledgement window opened`,`${event.firingInstanceId??event.ruleName} is awaiting acknowledgement.`);
    if(event.acknowledgementStatus==="acknowledged"&&previous?.acknowledgementStatus!=="acknowledged") add(event,"acknowledged",`${event.firingInstanceId??event.ruleName} acknowledged`,`The acknowledgement was accepted by the runtime.`);
    const timeoutEscalation=event.actions.some((action)=>action.reason==="acknowledgement_timeout");
    if(timeoutEscalation){
      add(event,"deadline_missed",`Acknowledgement deadline missed`,`${event.firingInstanceId??event.ruleName} reached its runtime deadline.`);
      add(event,"escalated",`Escalation triggered`,event.actions.filter((action)=>action.kind==="escalate").map((action)=>`Escalate to ${action.target}`).join(", "));
    }else if(event.escalationStatus.triggered&&!previous?.escalationStatus.triggered){
      add(event,"escalated",`Escalation triggered`,event.escalationStatus.target?`Escalate to ${event.escalationStatus.target}.`:"The runtime reported escalation.");
    }
    previousByRule.set(event.ruleName,event);
  }
  return markers;
}

export function RuntimeChart({ result, workflow, onSelect }: { result:SimulationResult; workflow:Workflow; onSelect:(event:SimulationEvent)=>void }) {
  const markers=deriveRuntimeMarkers(result.events);
  const monitored=workflow.monitors.map((monitor)=>monitor.name.name);
  const preferred=["oxygen","heart_rate",...monitored];
  const variables=[...new Set(preferred)].filter((variable)=>result.steps.some((step)=>Number.isFinite(step.patient[variable]))).slice(0,4);
  const minTime=result.steps[0]!.timeMs;
  const maxTime=Math.max(result.steps.at(-1)!.timeMs,minTime+1);
  return <section className="panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5e2] px-4 py-3"><div><b className="text-sm">Runtime signal analysis</b><p className="mt-0.5 text-[11px] text-[#71807c]">Patient series from simulation steps · markers from runtime events</p></div><div className="flex flex-wrap gap-2">{Object.entries(markerMeta).filter(([kind])=>markers.some((marker)=>marker.kind===kind)).map(([kind,meta])=><span key={kind} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#667672]"><span className="h-2 w-2 rounded-full" style={{background:meta.color}}/>{meta.short}</span>)}</div></div><div className="bg-[#fbfcfc] p-3 lg:p-5">
    <div className="space-y-3">{variables.map((variable)=><SignalLane key={variable} variable={variable} result={result} workflow={workflow} markers={markers} minTime={minTime} maxTime={maxTime} onSelect={onSelect}/>)}</div>
    <div className="mt-3 flex justify-between px-[52px] font-mono text-[10px] text-[#7a8b86]"><span>{formatTime(minTime)}</span><span>{formatTime(maxTime)}</span></div>
    {markers.length>0&&<div className="code-scroll mt-5 flex gap-2 overflow-x-auto pb-1">{markers.map((marker)=><button key={marker.id} onClick={()=>onSelect(marker.event)} className="min-w-[190px] rounded-lg border border-[#dce5e2] bg-white p-2.5 text-left hover:border-[#83bdb3]"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background:markerMeta[marker.kind].color}}/><span className="font-mono text-[10px] font-bold text-[#71807c]">{formatTime(marker.timestamp)}</span></div><b className="mt-1.5 block text-[11px] leading-4">{marker.label}</b></button>)}</div>}
  </div></section>;
}

function SignalLane({ variable,result,workflow,markers,minTime,maxTime,onSelect }:{variable:string;result:SimulationResult;workflow:Workflow;markers:RuntimeMarker[];minTime:number;maxTime:number;onSelect:(event:SimulationEvent)=>void}){
  const width=1000,height=116,left=58,right=16,top=16,bottom=22;
  const values=result.steps.map((step)=>step.patient[variable]).filter(Number.isFinite);
  const thresholdRules=workflow.rules.filter((rule)=>rule.condition.variable.name===variable);
  const thresholds=thresholdRules.map((rule)=>rule.condition.threshold.value);
  const all=[...values,...thresholds];
  const rawMin=Math.min(...all),rawMax=Math.max(...all);const padding=Math.max((rawMax-rawMin)*.18,1);
  const minValue=rawMin-padding,maxValue=rawMax+padding;
  const x=(time:number)=>left+((time-minTime)/(maxTime-minTime))*(width-left-right);
  const y=(value:number)=>top+(1-(value-minValue)/(maxValue-minValue))*(height-top-bottom);
  const points=result.steps.filter((step)=>Number.isFinite(step.patient[variable])).map((step)=>`${x(step.timeMs)},${y(step.patient[variable]!)}`).join(" ");
  const variableMarkers=markers.filter((marker)=>marker.event.ruleName&&workflow.rules.find((rule)=>rule.name.name===marker.event.ruleName)?.condition.variable.name===variable);
  return <div className="overflow-hidden rounded-lg border border-[#dce5e2] bg-white"><div className="flex items-center justify-between border-b border-[#edf1f0] px-3 py-2"><div><b className="text-xs capitalize">{variable.replaceAll("_"," ")}</b><span className="ml-2 font-mono text-[10px] text-[#71807c]">latest {result.final.patient[variable]}</span></div>{thresholdRules.length>0&&<span className="text-[10px] text-[#71807c]">{thresholdRules.map((rule)=>`${rule.condition.operator} ${rule.condition.threshold.value}`).join(" · ")}</span>}</div><svg viewBox={`0 0 ${width} ${height}`} className="block h-[116px] w-full" role="img" aria-label={`${variable.replaceAll("_"," ")} time series`}>
    <rect width={width} height={height} fill="#fbfdfc"/><line x1={left} y1={top} x2={left} y2={height-bottom} stroke="#dce5e2"/><line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} stroke="#dce5e2"/>
    {[0,.5,1].map((ratio)=><g key={ratio}><line x1={left} y1={top+ratio*(height-top-bottom)} x2={width-right} y2={top+ratio*(height-top-bottom)} stroke="#edf2f0"/><text x={left-8} y={top+ratio*(height-top-bottom)+3} textAnchor="end" fontSize="9" fill="#71807c">{Number((maxValue-ratio*(maxValue-minValue)).toFixed(1))}</text></g>)}
    {thresholdRules.map((rule)=><g key={rule.name.name}><line x1={left} y1={y(rule.condition.threshold.value)} x2={width-right} y2={y(rule.condition.threshold.value)} stroke="#c99031" strokeDasharray="5 4"/><text x={width-right-3} y={y(rule.condition.threshold.value)-4} textAnchor="end" fontSize="8" fill="#8b620e">{rule.name.name} threshold · AST</text></g>)}
    {variableMarkers.map((marker)=><g key={marker.id} onClick={()=>onSelect(marker.event)} className="cursor-pointer"><line x1={x(marker.timestamp)} y1={top} x2={x(marker.timestamp)} y2={height-bottom} stroke={markerMeta[marker.kind].color} strokeWidth="1.2" opacity=".65"/><circle cx={x(marker.timestamp)} cy={top+5} r="4" fill={markerMeta[marker.kind].color}><title>{marker.label}</title></circle></g>)}
    <polyline points={points} fill="none" stroke="#087f72" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{result.steps.filter((step)=>Number.isFinite(step.patient[variable])).map((step)=><circle key={step.timeMs} cx={x(step.timeMs)} cy={y(step.patient[variable]!)} r="3.5" fill="#fff" stroke="#087f72" strokeWidth="2"><title>{formatTime(step.timeMs)} · {step.patient[variable]}</title></circle>)}
  </svg></div>;
}

export function semanticTitle(event:SimulationEvent, previous?:SimulationEvent):string{
  const markers=deriveRuntimeMarkers(previous?[previous,event]:[event]).filter((marker)=>marker.event===event);
  return markers.at(-1)?.label??(event.conditionStatus==="waiting"?"Condition persisting":event.conditionStatus==="satisfied"?"Condition satisfied":event.conditionStatus==="unknown"?"Reading unknown":"Condition false");
}

export function markerColor(kind:MarkerKind){return markerMeta[kind].color;}
export function formatTime(ms:number){const total=Math.floor(ms/1000);return `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}
export function formatDuration(ms:number){return ms>=60_000?`${Number((ms/60_000).toFixed(2))}m`:`${Number((ms/1000).toFixed(2))}s`;}
