const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234 -> "₹1,234" */
export function formatINR(n: number): string {
  return inr.format(n);
}

/** 1234.5 -> "₹1,234.50" */
export function formatINR2(n: number): string {
  return inr2.format(n);
}

/** "2026-2027" -> "2026-27" */
export function fyLabel(fy: string): string {
  const m = fy.match(/^(\d{4})-(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[3]}` : fy;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-10" or ISO timestamp -> "10 Oct 2026" (no timezone surprises) */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}
