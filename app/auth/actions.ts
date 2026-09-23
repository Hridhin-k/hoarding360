"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type SignupResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Public Auth signup rejects many test/short Gmail addresses (email_address_invalid).
 * Owner onboarding uses Admin createUser + SECURITY DEFINER org bootstrap.
 */
export async function signUpOwner(input: {
  fullName: string;
  orgName: string;
  email: string;
  password: string;
}): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const orgName = input.orgName.trim();
  const password = input.password;

  if (!fullName || !orgName || !email || password.length < 6) {
    return { ok: false, error: "Fill in all fields (password at least 6 characters)." };
  }

  const admin = createAdminClient();

  let userId: string | undefined;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    const already =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");

    if (!already) {
      return { ok: false, error: createError.message };
    }

    // Resume bootstrap for an orphan auth user (created earlier without org)
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return { ok: false, error: "That email is already registered. Sign in instead." };
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      return { ok: false, error: "That email is already registered. Sign in instead." };
    }
    userId = existing.id;

    // Update password + metadata so they can sign in with what they just typed
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updateError) {
      return { ok: false, error: updateError.message };
    }
  } else {
    userId = created.user?.id;
  }

  if (!userId) {
    return { ok: false, error: "Account created but user id missing. Contact support." };
  }

  const { data: orgId, error: bootError } = await admin.rpc(
    "bootstrap_owner_organization",
    { p_org_name: orgName, p_user_id: userId },
  );

  if (bootError) {
    return {
      ok: false,
      error: bootError.message || "Could not create organization.",
    };
  }

  if (!orgId) {
    return { ok: false, error: "Organization bootstrap returned no id." };
  }

  return { ok: true };
}
