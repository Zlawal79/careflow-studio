import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/careflow/app-nav";
import "./globals.css";

const geistSans = Geist({ variable:"--font-geist-sans", subsets:["latin"] });
const geistMono = Geist_Mono({ variable:"--font-geist-mono", subsets:["latin"] });

export const metadata: Metadata = {
  title:"CareFlow Studio — Clinical Workflow Engineering",
  description:"Design, validate, simulate, and audit synthetic healthcare workflows with the CareFlow DSL.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}><body><div className="min-h-screen"><AppNav /><main>{children}</main></div></body></html>;
}
