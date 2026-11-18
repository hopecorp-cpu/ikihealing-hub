"use server";
import { getServerClient, getServiceClient } from "@/lib/supabase-server";
import { parseOrdersCsv, type ParsedOrder } from "@/lib/orders-csv-parser";
import { fileToCsv } from "@/lib/file-to-csv";
import { revalidatePath } from "next/cache";

function readInputToCsv(input: { csvContent?: string; fileBase64?: string; fileName?: string }): { csv: string; format: string } {
  if (input.fileBase64) {
    const binary = Buffer.from(input.fileBase64, "base64");
    const r = fileToCsv(new Uint8Array(binary), input.fileName || "upload.xlsx");
    return { csv: r.csvContent, format: r.detectedFormat };
  }
  if (input.csvContent) {
    const r = fileToCsv(input.csvContent, input.fileName || "upload.csv");
    return { csv: r.csvContent, format: r.detectedFormat };
  }
  return { csv: "", format: "unknown" };
}

async function requireAdmin() {
  const auth = getServerClient();
  const { data: { user: authUser } } = await auth.auth.getUser();
  if (!authUser) throw new Error("Chưa đăng nhập");
  const sb = getServiceClient();
  const { data: profile } = await sb.from("users").select("role").eq("id", authUser.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "ceo")) {
    throw new Error("Không có quyền");
  }
  return { sb, adminId: authUser.id };
}

export async function previewCsvImport(input: { csvContent?: string; fileBase64?: string; fileName?: string; forceFormat?: string }) {
  await requireAdmin();
  try {
    const { csv, format } = readInputToCsv(input);
    if (!csv) return { success: false, error: "File rỗng" };
    const result = parseOrdersCsv(csv, input.forceFormat);
    (result as any).fileFormat = format;
    const stats = {
      total: result.parsed.length,
      withErrors: result.parsed.filter(p => p.errors.length > 0).length,
      totalGross: result.parsed.reduce((s, p) => s + p.gross_revenue, 0),
      totalFinal: result.parsed.reduce((s, p) => s + p.final_revenue, 0),
      uniqueCustomers: new Set(result.parsed.map(p => p.customer_phone).filter(Boolean)).size,
      uniqueSKUs: new Set(result.parsed.map(p => p.product_sku).filter(Boolean)).size,
      dateRange: {
        from: result.parsed.length > 0 ? result.parsed.map(p => p.order_date).sort()[0] : null,
        to: result.parsed.length > 0 ? result.parsed.map(p => p.order_date).sort().slice(-1)[0] : null
      }
    };
    return { success: true, result, stats };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function commitCsvImport(input: {
  csvContent?: string;
  fileBase64?: string;
  fileName?: string;
  forceFormat?: string;
  defaultSaleId?: string;
  skipDuplicates: boolean;
}) {
  const { sb, adminId } = await requireAdmin();

  const { csv } = readInputToCsv(input);
  if (!csv) return { success: false, error: "File rỗng" };
  const { parsed } = parseOrdersCsv(csv, input.forceFormat);
  if (parsed.length === 0) return { success: false, error: "Không có đơn nào để import" };

  let existingCodes = new Set<string>();
  if (input.skipDuplicates) {
    const allCodes = parsed.map(p => p.order_code);
    const { data: existing } = await sb.from("orders").select("order_code").in("order_code", allCodes);
    existingCodes = new Set((existing ?? []).map((x: any) => x.order_code));
  }

  const customerMap = new Map<string, string>();
  const uniqueCustomers = new Map<string, ParsedOrder>();
  for (const p of parsed) {
    if (p.customer_phone && !uniqueCustomers.has(p.customer_phone)) {
      uniqueCustomers.set(p.customer_phone, p);
    }
  }
  if (uniqueCustomers.size > 0) {

    const phones = Array.from(uniqueCustomers.keys());
    const { data: existingCusts } = await sb.from("customers").select("id, phone").in("phone", phones);
    (existingCusts ?? []).forEach((c: any) => customerMap.set(c.phone, c.id));

    const toInsert = Array.from(uniqueCustomers.entries())
      .filter(([phone]) => !customerMap.has(phone))
      .map(([phone, p]) => ({
        full_name: p.customer_name || "Unknown",
        phone,
        address: p.customer_address || null
      }));
    if (toInsert.length > 0) {
      const { data: newCusts } = await sb.from("customers").insert(toInsert).select("id, phone");
      (newCusts ?? []).forEach((c: any) => customerMap.set(c.phone, c.id));
    }
  }

  const productMap = new Map<string, string>();
  const uniqueProducts = new Map<string, ParsedOrder>();
  for (const p of parsed) {
    if (p.product_sku && !uniqueProducts.has(p.product_sku)) {
      uniqueProducts.set(p.product_sku, p);
    }
  }
  if (uniqueProducts.size > 0) {
    const skus = Array.from(uniqueProducts.keys());
    const { data: existingProds } = await sb.from("products").select("id, sku").in("sku", skus);
    (existingProds ?? []).forEach((p: any) => productMap.set(p.sku, p.id));

    const toInsert = Array.from(uniqueProducts.entries())
      .filter(([sku]) => !productMap.has(sku))
      .map(([sku, p]) => ({
        sku,
        name: p.product_name || sku,
        price: p.unit_price,
        active: true
      }));
    if (toInsert.length > 0) {
      const { data: newProds } = await sb.from("products").insert(toInsert).select("id, sku");
      (newProds ?? []).forEach((p: any) => productMap.set(p.sku, p.id));
    }
  }

  let inserted = 0, skipped = 0, failed = 0;
  const failedRows: any[] = [];

  for (const p of parsed) {
    if (input.skipDuplicates && existingCodes.has(p.order_code)) {
      skipped++;
      continue;
    }

    const customerId = p.customer_phone ? customerMap.get(p.customer_phone) : null;
    const productId = p.product_sku ? productMap.get(p.product_sku) : null;

    const { data: order, error: ordErr } = await sb.from("orders").insert({
      order_code: p.order_code,
      customer_id: customerId,
      salesperson_id: input.defaultSaleId || null,
      channel: p.channel,
      sub_channel: p.sub_channel,
      gross_revenue: p.gross_revenue,
      discount_value: p.discount_value,
      shipping_cost: p.shipping_cost,
      quantity: p.quantity,
      status: p.status,
      order_date: p.order_date,
      source_platform: "csv_import",
      channel_code: p.channel.toLowerCase().replace(/\s+/g, "_"),
      counts_for_bonus: true
    }).select("id").single();

    if (ordErr || !order) {
      failed++;
      failedRows.push({ row: p.raw_line, code: p.order_code, error: ordErr?.message });
      continue;
    }

    if (productId) {
      await sb.from("order_items").insert({
        order_id: order.id,
        product_id: productId,
        quantity: p.quantity,
        unit_price: p.unit_price
      });
    }
    inserted++;
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/bang-luong");

  return {
    success: true,
    inserted,
    skipped,
    failed,
    failedRows,
    customersCreated: customerMap.size,
    productsCreated: productMap.size
  };
}

export async function getSaleUsers() {
  const { sb } = await requireAdmin();
  const { data } = await sb.from("users").select("id, full_name, position")
    .eq("active", true)
    .ilike("position", "%sale%");
  return data ?? [];
}
