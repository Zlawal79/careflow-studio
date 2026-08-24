import { StudioWorkspace } from "@/components/studio/studio-workspace";

export default async function StudioPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params=await searchParams;
  return <StudioWorkspace initialExampleId={typeof params.example==="string"?params.example:undefined}/>;
}
