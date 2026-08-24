import Link from "next/link";

const syntax=[
  ["workflow", "Defines one named executable workflow and contains monitor declarations and rules."],
  ["monitor", "Declares a numeric input that rules may reference."],
  ["rule", "Names an independently evaluated condition and its actions."],
  ["when", "Begins a numeric comparison using <, >, <=, >=, ==, or !=."],
  ["for", "Requires a true condition to persist for seconds, minutes, or hours."],
  ["then", "Contains alert, priority, escalation, and acknowledgement behavior."],
  ["alert", "Emits an alert action for a synthetic recipient."],
  ["priority", "Assigns low, medium, high, or critical priority."],
  ["require acknowledgment within", "Starts a deadline when a rule instance fires."],
  ["otherwise escalate", "Emits one escalation if acknowledgement misses its deadline."],
];

export default function DocumentationPage(){return <div className="mx-auto grid max-w-[1450px] gap-10 px-5 py-10 lg:grid-cols-[250px_1fr] lg:px-8"><aside className="h-fit lg:sticky lg:top-24"><p className="eyebrow mb-4">Documentation</p><nav className="space-y-1">{["What CareFlow is","Language philosophy","Syntax reference","Validation","Simulation semantics","Architecture","Examples"].map((item)=><a key={item} href={`#${item.toLowerCase().replaceAll(" ","-")}`} className="block rounded-md px-3 py-2 text-sm font-semibold text-[#61706c] no-underline hover:bg-white hover:text-[#087f72]">{item}</a>)}</nav><Link href="/studio" className="mt-6 block rounded-lg bg-[#087f72] px-4 py-3 text-center text-sm font-bold text-white no-underline">Open Studio →</Link></aside><article className="min-w-0 max-w-4xl"><header className="border-b border-[#dce5e2] pb-8"><h1 className="text-4xl font-bold tracking-tight">CareFlow Language Guide</h1><p className="mt-4 text-lg leading-8 text-[#62716d]">A concise reference for designing, validating, simulating, and auditing synthetic healthcare workflows.</p><div className="mt-5 rounded-lg border border-[#e2c989] bg-[#fffaf0] px-4 py-3 text-sm text-[#73551a]"><b>CareFlow is a hackathon prototype for workflow modeling and simulation.</b> It is not a medical device and does not provide clinical guidance.</div></header>
  <Doc id="what-careflow-is" title="What CareFlow is"><p>CareFlow is a domain-specific language for expressing monitoring, persistence, alerting, acknowledgement, and escalation logic as an executable specification. The same source that a human reviews is parsed, validated, and simulated by the runtime.</p></Doc>
  <Doc id="language-philosophy" title="Why a healthcare DSL"><p>Healthcare workflow logic is often distributed across configuration screens, prose, and implementation code. CareFlow explores a narrower, auditable representation: readable enough for multidisciplinary review, structured enough for static analysis, and executable enough for deterministic testing.</p><ul><li>Readable domain vocabulary</li><li>Explicit temporal and escalation semantics</li><li>Validation before execution</li><li>Reproducible event traces for audit</li></ul></Doc>
  <Doc id="syntax-reference" title="Syntax reference"><div className="grid gap-3">{syntax.map(([term,desc])=><div key={term} className="panel grid gap-2 p-4 md:grid-cols-[220px_1fr]"><code className="font-mono text-sm font-bold text-[#087f72]">{term}</code><p className="text-sm leading-6 text-[#61706c]">{desc}</p></div>)}</div><pre className="code-scroll mt-5 overflow-x-auto rounded-xl bg-[#13201e] p-5 font-mono text-xs leading-6 text-[#d7e7e3]">{`workflow respiratory_monitor {
  monitor oxygen

  rule low_oxygen {
    when oxygen < 92 for 30 seconds
    then {
      alert nurse
      priority high
      require acknowledgment within 2 minutes
      otherwise escalate physician
    }
  }
}`}</pre></Doc>
  <Doc id="validation" title="Semantic validation"><p>After parsing, CareFlow validates declarations, priorities, durations, acknowledgement structure, duplicate rules, unused monitors, and numeric rule relationships. Programs with validation errors are blocked by the high-level execution APIs.</p></Doc>
  <Doc id="simulation-semantics" title="Simulation semantics"><ol><li>A temporal timer begins when its comparison first becomes true.</li><li>False, missing, or non-finite values reset that timer.</li><li>A rule fires once when the exact duration boundary is reached.</li><li>Continuous truth does not cause repeat firing.</li><li>A false or unknown observation rearms the next firing cycle.</li><li>Acknowledgement at the exact deadline wins over timeout.</li><li>A missed deadline emits its escalation exactly once.</li></ol></Doc>
  <Doc id="architecture" title="Architecture"><div className="panel p-5 font-mono text-sm leading-8 text-[#31504a]">Source → Lexer → Tokens → Parser → Typed AST<br/>Typed AST → Semantic Validator<br/>Typed AST + Synthetic Time Series → Stateful Interpreter<br/>Stateful Interpreter → Events + Actions + Execution Trace</div><p className="mt-4">The visual builder, workflow diagram, simulator, timeline, and language explorer are adapters around this pipeline. None contains a parallel rules engine.</p></Doc>
  <Doc id="examples" title="Synthetic examples"><p>CareFlow includes respiratory monitoring, cardiac deterioration, critical laboratory escalation, and medical device alert programs. Their values and response paths exist only to demonstrate language behavior.</p></Doc>
  </article></div>;}

function Doc({id,title,children}:{id:string;title:string;children:React.ReactNode}){return <section id={id} className="scroll-mt-24 border-b border-[#dce5e2] py-9 last:border-0"><h2 className="mb-4 text-2xl font-bold tracking-tight">{title}</h2><div className="space-y-4 text-[15px] leading-7 text-[#52635e] [&_li]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc">{children}</div></section>;}
