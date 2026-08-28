import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";
import { ImpersonationNotice } from "@/components/impersonation-notice";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="space-y-4">
      <SignInForm next={next} />
      <ImpersonationNotice />
    </div>
  );
}
