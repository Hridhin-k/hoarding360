"use client";

import { permissionsForRole, MODULE_ACTIONS } from "@/lib/domain/permissions";
import { ORG_ROLES } from "@/lib/domain/status";

/** M01 · Read-only module.action matrix for admins. */
export function PermissionMatrixPanel() {
  return (
    <section className="space-y-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium">Permission matrix</h2>
        <p className="text-xs text-[var(--muted)]">
          M01 · module.action · enforced in server actions + nav hide
        </p>
      </div>
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted)]">
            <th className="sticky left-0 bg-white py-2 pr-3 font-medium">Action</th>
            {ORG_ROLES.map((r) => (
              <th key={r} className="px-1 py-2 font-medium">
                {r.replace(/_/g, " ").slice(0, 12)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULE_ACTIONS.map((action) => (
            <tr key={action} className="border-b border-[var(--border)]">
              <td className="sticky left-0 bg-white py-1.5 pr-3 font-mono text-[10px]">
                {action}
              </td>
              {ORG_ROLES.map((role) => {
                const allowed = permissionsForRole(role).includes(action);
                return (
                  <td key={role} className="px-1 py-1.5 text-center">
                    {allowed ? (
                      <span className="text-[var(--google-green)]">✓</span>
                    ) : (
                      <span className="text-[var(--muted)]">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
