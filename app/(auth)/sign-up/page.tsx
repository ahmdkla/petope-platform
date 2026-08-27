import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";
import { ImpersonationNotice } from "@/components/impersonation-notice";

export const metadata: Metadata = { title: "Create account — EXSAVERSE" };

export default function SignUpPage() {
  return (
    <div className="space-y-4">
      <SignUpForm />
      <ImpersonationNotice />
    </div>
  );
}
