import Link from "next/link";
import { manageNavGroupsForRole } from "@/lib/domain/roles";
import { isFieldRole } from "@/lib/domain/products";
import type { OrgRole } from "@/lib/domain/status";

type Props = {
  role?: OrgRole | string | null;
};

export function ManageSidebar({ role }: Props) {
  const groups = manageNavGroupsForRole(role);
  const showFieldLink =
    isFieldRole(role) || role === "company_admin" || role === "operations_manager";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-white">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <Link href="/manage" className="text-base font-medium text-[var(--ink)]">
          Manage
        </Link>
        <p className="mt-0.5 text-xs text-[var(--muted)]">CRM · media owners</p>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 text-sm">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-[var(--muted)] hover:bg-[var(--wash)] hover:text-[var(--ink)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-2 border-t border-[var(--border)] p-3 text-xs text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]">Other products</p>
        <Link href="/boards" className="block hover:text-[var(--ink)]">
          Marketplace (public listings)
        </Link>
        {showFieldLink ? (
          <Link href="/field" className="block hover:text-[var(--ink)]">
            Field PWA (site tasks)
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
