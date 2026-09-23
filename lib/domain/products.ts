/**
 * HOARDINGS360 is one codebase, three products.
 * Never blur audiences in chrome, CTAs, or post-login routing.
 */

export const PRODUCTS = {
  market: {
    id: "market",
    name: "Marketplace",
    path: "/",
    listingsPath: "/boards",
    audience: "Public advertisers and agencies",
    job: "Browse verified outdoor inventory and enquire to place an ad",
  },
  manage: {
    id: "manage",
    name: "Manage",
    path: "/manage",
    audience: "Media owners and their staff",
    job: "CRM / owner OS — inventory, permits, contracts, publish to Market",
  },
  field: {
    id: "field",
    name: "Field",
    path: "/field",
    audience: "Field technicians and supervisors of a tenant",
    job: "On-site tasks — QR, proof of display, incidents, offline queue",
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;

/** Login destinations — never send a public Market visitor into Field by default. */
export function defaultAppPathForRole(
  role: string | null | undefined,
): "/manage" | "/field" | "/admin" {
  if (role === "field_technician" || role === "field_supervisor") return "/field";
  return "/manage";
}

export function isFieldRole(role: string | null | undefined): boolean {
  return role === "field_technician" || role === "field_supervisor";
}

export function canOpenManageFromField(role: string | null | undefined): boolean {
  return (
    role === "company_admin" ||
    role === "operations_manager" ||
    role === "field_supervisor"
  );
}
