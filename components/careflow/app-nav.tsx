"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["Overview","/"],["Workflow Studio","/studio"],["Simulator","/simulator"],["Language","/language"],["Documentation","/docs"]] as const;

export function AppNav() {
  const pathname = usePathname();
  return <header className="sticky top-0 z-50 border-b border-[#dce5e2] bg-white/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1600px] items-center gap-8 px-5 lg:px-8">
    <Link href="/" className="flex shrink-0 items-center gap-3 text-[#14211f] no-underline"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#087f72] text-lg font-bold text-white">C</span><span><b className="block text-[15px] tracking-tight">CareFlow</b><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-[#71807c]">Studio</span></span></Link>
    <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{links.map(([label,href]) => { const active=href==="/"?pathname==="/":pathname.startsWith(href); return <Link key={href} href={href} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold no-underline transition ${active?"bg-[#e7f5f2] text-[#076a60]":"text-[#61706c] hover:bg-[#f4f7f6] hover:text-[#14211f]"}`}>{label}</Link>; })}</nav>
    <div className="hidden items-center gap-2 rounded-full border border-[#b7ddd6] bg-[#f0faf8] px-3 py-1.5 text-xs font-bold text-[#087f72] xl:flex"><span className="status-dot bg-[#18a38f]" /> Engine online</div>
  </div></header>;
}
