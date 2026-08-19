import { Workspace } from "@/components/workspace";
import { ThemeBoot } from "@/components/theme-boot";

export default async function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <ThemeBoot />
      <Workspace id={id} />
    </>
  );
}
