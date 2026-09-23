import Link from "next/link";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const failed = Boolean(sp.error);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-2xl font-medium tracking-tight">
        HOARDINGS<span className="text-[var(--primary)]">360</span>
      </Link>
      <h1 className="mt-8 text-xl font-medium">
        {failed ? "Verification issue" : "Email verified"}
      </h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {failed
          ? "The link may have expired. Sign in or request a new confirmation from your inbox."
          : "Your email is confirmed. You can sign in to Manage."}
      </p>
      <p className="mt-6 text-sm">
        <Link href="/auth/login" className="text-[var(--primary)] hover:underline">
          Continue to sign in
        </Link>
      </p>
    </div>
  );
}
