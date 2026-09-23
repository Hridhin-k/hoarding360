import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, gstin, industry")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Clients</h1>
          <p className="text-sm text-[var(--muted)]">M05 · Advertiser companies</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/manage/agreements/new"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
          >
            New agreement
          </Link>
          <Link
            href="/manage/clients/new"
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add client
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--risk)]">{error.message}</p> : null}

      {!clients?.length ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p>No clients yet</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Add an advertiser company, then create agreements on faces.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--wash)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3">Industry</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/manage/clients/${c.id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.gstin ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.industry ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
