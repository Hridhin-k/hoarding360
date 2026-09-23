/** Indian display helpers */

export function formatInrFromPaise(paise: number | null | undefined): string {
  if (paise == null) return "—";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function formatIstDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

/** Normalize Indian mobile to +91XXXXXXXXXX or null if invalid. */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("91") && national.length === 12) {
    national = national.slice(2);
  } else if (national.startsWith("0") && national.length === 11) {
    national = national.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(national)) return null;
  return `+91${national}`;
}

