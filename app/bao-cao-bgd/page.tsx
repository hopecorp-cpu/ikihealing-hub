import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BaoCaoBgdRedirect({ searchParams }: { searchParams: { m?: string } }) {
  redirect(searchParams.m ? `/bang-dieu-hanh?m=${searchParams.m}` : "/bang-dieu-hanh");
}
