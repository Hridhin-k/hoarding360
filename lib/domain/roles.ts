import type { OrgRole } from "@/lib/domain/status";

export type ManageNavItem = {
  href: string;
  label: string;
  roles: string[] | null;
};

export type ManageNavGroup = {
  id: "home" | "sales" | "ops" | "compliance" | "reports" | "admin";
  label: string;
  items: ManageNavItem[];
};

const NAV_GROUPS: ManageNavGroup[] = [
  {
    id: "home",
    label: "Home",
    items: [{ href: "/manage", label: "Dashboard", roles: null }],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        href: "/manage/clients",
        label: "Clients",
        roles: [
          "company_admin",
          "operations_manager",
          "sales_executive",
          "finance_officer",
        ],
      },
      {
        href: "/manage/agreements",
        label: "Agreements",
        roles: ["company_admin", "operations_manager", "sales_executive"],
      },
      {
        href: "/manage/agreements/new",
        label: "New agreement",
        roles: ["company_admin", "operations_manager", "sales_executive"],
      },
      {
        href: "/manage/availability",
        label: "Availability",
        roles: [
          "company_admin",
          "operations_manager",
          "sales_executive",
          "field_supervisor",
        ],
      },
      {
        href: "/manage/vacancies",
        label: "Vacancies",
        roles: [
          "company_admin",
          "operations_manager",
          "sales_executive",
          "finance_officer",
        ],
      },
    ],
  },
  {
    id: "ops",
    label: "Ops",
    items: [
      { href: "/manage/boards", label: "Boards", roles: null },
      {
        href: "/manage/boards/map",
        label: "Map",
        roles: [
          "company_admin",
          "operations_manager",
          "sales_executive",
          "compliance_officer",
          "field_supervisor",
        ],
      },
      {
        href: "/manage/import",
        label: "Import",
        roles: ["company_admin", "operations_manager"],
      },
      {
        href: "/manage/incidents",
        label: "Incidents",
        roles: [
          "company_admin",
          "operations_manager",
          "field_supervisor",
          "compliance_officer",
        ],
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    items: [
      {
        href: "/manage/compliance",
        label: "Risk & renewals",
        roles: ["company_admin", "operations_manager", "compliance_officer"],
      },
      {
        href: "/manage/compliance/vault",
        label: "Doc vault",
        roles: ["company_admin", "operations_manager", "compliance_officer"],
      },
      {
        href: "/manage/notifications",
        label: "Alerts",
        roles: null,
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      {
        href: "/manage/activity",
        label: "Activity log",
        roles: ["company_admin", "operations_manager", "compliance_officer"],
      },
      {
        href: "/manage/vacancies?days=90",
        label: "Vacancy pipeline",
        roles: [
          "company_admin",
          "operations_manager",
          "sales_executive",
          "finance_officer",
        ],
      },
      {
        href: "/manage/reports",
        label: "Exports",
        roles: [
          "company_admin",
          "operations_manager",
          "finance_officer",
        ],
      },
      {
        href: "/manage/calendar",
        label: "Heat calendar",
        roles: ["company_admin", "operations_manager", "sales_executive"],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      {
        href: "/manage/proof-review",
        label: "Proof review",
        roles: ["company_admin", "operations_manager", "field_supervisor"],
      },
      {
        href: "/manage/settings",
        label: "Settings",
        roles: ["company_admin", "operations_manager"],
      },
    ],
  },
];

function allowed(roles: string[] | null, role: OrgRole | string | null | undefined) {
  if (!roles) return true;
  if (!role) return false;
  return roles.includes(role);
}

/** Grouped nav — hide empty groups; never show disabled items. */
export function manageNavGroupsForRole(
  role: OrgRole | string | null | undefined,
): ManageNavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => allowed(item.roles, role)),
  })).filter((g) => g.items.length > 0);
}

/** Flat list (compat) */
export function manageNavForRole(role: OrgRole | string | null | undefined): {
  href: string;
  label: string;
}[] {
  return manageNavGroupsForRole(role).flatMap((g) =>
    g.items.map(({ href, label }) => ({ href, label })),
  );
}

export function canSeeFloorRates(role: OrgRole | string | null | undefined): boolean {
  return (
    role === "company_admin" ||
    role === "operations_manager" ||
    role === "finance_officer"
  );
}

export function canSeeCosts(role: OrgRole | string | null | undefined): boolean {
  return canSeeFloorRates(role);
}
