"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button, Card, FormError, Input, Label } from "@/components/ui";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    setPending(false);

    if (error) {
      // Deliberately does not distinguish "no such account" from "wrong
      // password" — that difference is an account-enumeration oracle.
      setError(
        error.status === 429
          ? "Too many sign-in attempts. Wait a minute and try again."
          : "Email or password is incorrect.",
      );
      return;
    }

    router.push(next ?? "/middlemen");
    router.refresh();
  }

  return (
    <Card>
      <h1 className="text-section-lg font-bold tracking-tight text-ink">Sign in</h1>
      <p className="mt-1.5 text-body text-ink-muted">
        Access your deal rooms and middleman queue.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
            autoComplete="current-password"
          />
        </div>

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-body text-ink-muted">
        No account?{" "}
        <Link href="/sign-up" className="font-medium text-accent-text underline underline-offset-2">
          Create one
        </Link>
      </p>
    </Card>
  );
}
