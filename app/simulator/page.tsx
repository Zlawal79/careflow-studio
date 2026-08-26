import { SimulatorWorkspace } from "@/components/simulator/simulator-workspace";
export default async function SimulatorPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params=await searchParams;
  return <SimulatorWorkspace autoRunVentilator={params.demo==="ventilator"}/>;
}
