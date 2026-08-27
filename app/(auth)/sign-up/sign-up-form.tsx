"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { acceptTerms } from "./actions";
import { Button, Card, FormError, Input, Label } from "@/components/ui";

const MIN_PASSWORD = 12;

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (!form.get("terms")) {
      setError("You must accept the guidelines and privacy policy to continue.");
      return;
    }

    setPending(true);
    const { error } = await signUp.email({
      email: String(form.get("email")),
      password,
      name: String(form.get("displayName")),
    });

    if (error) {
      setPending(false);
      setError(
        error.status === 429
          ? "Too many sign-up attempts. Try again later."
          : (error.message ?? "Could not create the account."),
      );
      return;
    }

    // CLAUDE.md requires explicit, recorded consent rather than the Discord's
    // implicit "opening a ticket means you agree".
    await acceptTerms();

    setPending(false);
    router.push("/middlemen");
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-section-lg font-bold tracking-tight text-ink">Create account</h1>
      <p className="mt-1.5 text-body text-ink-muted">
        Buyers, sellers and middlemen use the same account.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" name="displayName" required autoComplete="nickname" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
          />
          <p className="text-meta text-ink-faint">
            At least {MIN_PASSWORD} characters.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-body text-ink-muted">
          <input
            type="checkbox"
            name="terms"
            className="mt-1 size-4 cursor-pointer rounded-md border-line bg-raised accent-accent"
          />
          <span>
            I accept the{" "}
            <Link href="/guidelines" className="font-medium text-accent-text underline underline-offset-2">
              guidelines and privacy policy
            </Link>
            .
          </span>
        </label>

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-body text-ink-muted">
        Already registered?{" "}
        <Link href="/sign-in" className="font-medium text-accent-text underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
