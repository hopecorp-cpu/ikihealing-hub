import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ChuyenHuong({ searchParams }: { searchParams?: Record<string, string> }) {
  const hoiThoai = searchParams?.["hoi-thoai"];
  redirect(hoiThoai ? `/zalo/tin-nhan?hoi-thoai=${encodeURIComponent(hoiThoai)}` : "/zalo/tin-nhan");
}
