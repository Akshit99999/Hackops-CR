import type { DisputeCase, WarrantyItem } from "./types";

export const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
export const today = () => offsetDate(0);
export function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function daysUntil(value: string) {
  const target = new Date(`${value}T00:00:00`);
  const current = new Date();
  current.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - current.getTime()) / 86400000);
}
export function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function expiryDate(purchase: string, months: number) {
  const date = new Date(`${purchase}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(
    Math.min(
      day,
      new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
    ),
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function coverage(item: WarrantyItem) {
  const days = daysUntil(item.expiryDate);
  const total = Math.max(
    1,
    (new Date(item.expiryDate).getTime() -
      new Date(item.purchaseDate).getTime()) /
      86400000,
  );
  return {
    days: Math.max(0, days),
    status: days <= 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Protected",
    percent: Math.max(0, Math.min(100, (100 * days) / total)),
  };
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function draftNotice(item: DisputeCase) {
  return `# Consumer resolution request — ${item.id}\n\nFrom: ${item.consumerName}\nTo: ${item.merchant}\nProduct: ${item.product}\nPurchase date: ${item.purchaseDate}\nIssue discovered: ${item.defectDate}\n\n## What happened\n${item.narrative}\n\n## Requested resolution\nI am requesting a refund of ${currency(item.claimAmount)} (USD). Please respond within 15 days of receiving this request. This is a requested response period, not a determination of a statutory deadline.\n\n## Evidence inventory\n${item.documents.map((doc) => `- ${doc.name} — SHA-256: ${doc.sha256}`).join("\n") || "No supporting documents attached."}\n\nPlease review all facts, applicable warranty terms, and recipient details before sending. File hashes record integrity; they do not independently establish authenticity or admissibility. This frontend has not sent this notice.\n${item.sample ? "\nSAMPLE DATA — for demonstration only.\n" : ""}`;
}
