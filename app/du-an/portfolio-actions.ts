"use server";
import { requireManager } from "@/lib/auth-server";
import { getPortfolio, savePortfolio, touchProject, type PortfolioItem } from "@/lib/portfolio";
import { vnDateStr } from "@/lib/payroll";
import { revalidatePath } from "next/cache";

export async function touchProjectAction(id: string, nextStep?: string) {
  await requireManager();
  await touchProject(id, nextStep != null ? { nextStep } : {});
  revalidatePath("/du-an");
}

export async function setStatusAction(id: string, status: PortfolioItem["status"]) {
  await requireManager();
  const list = await getPortfolio();
  const i = list.findIndex((p) => p.id === id);
  if (i >= 0) { list[i] = { ...list[i], status, lastUpdate: vnDateStr() }; await savePortfolio(list); }
  revalidatePath("/du-an");
}

export async function addProjectAction(name: string, area: string, priority: PortfolioItem["priority"], nextStep: string) {
  await requireManager();
  const list = await getPortfolio();
  const id = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `du-an-${list.length + 1}`;
  if (!list.some((p) => p.id === id)) {
    list.push({ id, name: name.trim(), area: area.trim() || "Khác", status: "active", priority, nextStep: nextStep.trim(), lastUpdate: vnDateStr() });
    await savePortfolio(list);
  }
  revalidatePath("/du-an");
}
