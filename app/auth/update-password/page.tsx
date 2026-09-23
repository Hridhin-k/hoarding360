import Link from "next/link";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="text-2xl font-medium tracking-tight">
        HOARDINGS<span className="text-[var(--primary)]">360</span>
      </Link>
      <h1 className="mt-8 text-xl font-medium">Choose a new password</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        You opened a recovery link — set a password to finish.
      </p>
      <div className="mt-6">
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
