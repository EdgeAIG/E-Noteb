import { Home } from "@/components/home";
import { ThemeBoot } from "@/components/theme-boot";
import { ensureSeed } from "@/lib/seed";
import { listNotebooks } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Page() {
  await ensureSeed();
  const notebooks = listNotebooks();
  return (
    <>
      <ThemeBoot />
      <Home initial={notebooks} />
    </>
  );
}
