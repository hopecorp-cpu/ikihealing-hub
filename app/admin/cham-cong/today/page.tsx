import { redirect } from "next/navigation";

export default function TodayRedirect({ searchParams }: { searchParams: { d?: string } }) {
  const d = searchParams.d ? `&d=${searchParams.d}` : "";
  redirect(`/admin/cham-cong?tab=today${d}`);
}
