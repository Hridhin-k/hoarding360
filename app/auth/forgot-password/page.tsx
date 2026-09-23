import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-2xl font-medium tracking-tight">
        HOARDINGS<span className="text-[var(--primary)]">360</span>
      </Link>
      <h1 className="mt-8 text-xl font-medium">Reset password</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        M01 · We email a secure link. After you open it, choose a new password.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/auth/login" className="text-[var(--primary)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
