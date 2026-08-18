import { Workspace } from "@/components/workspace";
import { ThemeBoot } from "@/components/theme-boot";

export default function NotebookPage({ params }: { params: { id: string } }) {
  return (
    <>
      <ThemeBoot />
      <Workspace id={params.id} />
    </>
  );
}
