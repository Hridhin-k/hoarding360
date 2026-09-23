import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="font-[family-name:var(--font-display)] text-2xl">
        HOARDINGS<span className="text-[var(--accent)]">360</span>
      </Link>
      <h1 className="mt-8 text-xl font-medium">Create Manage CRM account</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        For media owners — creates your organisation so you can inventory boards, permits, and
        contracts, then publish faces to the public Marketplace. Field staff are invited by your
        admin (they use the Field PWA).
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        Already registered?{" "}
        <Link href="/auth/login" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
