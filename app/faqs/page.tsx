import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, TriangleAlert, ArrowRight } from "lucide-react";
import { AppShell, PageHeader, PageBody } from "@/components/shell/app-shell";
import { Badge, Card, Note, SectionTitle } from "@/components/ui";
import { ImpersonationNotice } from "@/components/impersonation-notice";
import { GENERAL_FAQ, methodFaqs } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQs — EXSAVERSE",
  description:
    "How escrow works, what a middleman does, what collateral is, and the exact money flow of every deal method.",
};

export default function FaqsPage() {
  const methods = methodFaqs();

  return (
    <AppShell>
      <PageHeader
        title="Frequently asked questions"
        description="How the escrow works, and exactly how money moves on each deal method."
      />

      <PageBody>
        <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionTitle>The basics</SectionTitle>
              {GENERAL_FAQ.map((entry) => (
                <Card key={entry.question} className="space-y-3">
                  <h3 className="flex items-start gap-2.5 text-lead font-semibold text-ink">
                    <CircleHelp
                      aria-hidden
                      className="mt-0.5 size-[18px] shrink-0 text-ink-faint"
                      strokeWidth={1.75}
                    />
                    {entry.question}
                  </h3>
                  {entry.answer.map((p, i) => (
                    <p key={i} className="text-body text-ink-muted">
                      {p}
                    </p>
                  ))}
                </Card>
              ))}
            </section>

            <section className="space-y-4">
              <SectionTitle>The seven deal methods</SectionTitle>
              <Note>
                Every figure below is read from the same configuration the escrow
                engine uses, so this page cannot drift out of step with what the
                platform actually does.
              </Note>

              {methods.map(({ rule, buyerPays, collateral, handover, timers }) => (
                <Card key={rule.id} className="space-y-4" id={rule.id.toLowerCase()}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-section font-semibold tracking-tight text-ink">
                      {rule.label}
                    </h3>
                    {rule.implemented ? null : (
                      <Badge tone="warn">
                        <TriangleAlert aria-hidden className="size-3.5" strokeWidth={2} />
                        Not available yet
                      </Badge>
                    )}
                  </div>

                  <p className="text-body text-ink-muted">{rule.summary}</p>

                  {rule.implemented ? (
                    <>
                      <dl className="grid gap-4 sm:grid-cols-3">
                        <Fact label="Buyer pays" value={buyerPays} />
                        <Fact label="Collateral" value={collateral} />
                        <Fact label="Changes hands off-platform" value={handover} />
                      </dl>

                      {timers.length > 0 ? (
                        <div className="rounded-lg border border-line bg-raised p-4">
                          <p className="text-meta font-medium text-ink-muted">Timing</p>
                          <ul className="mt-2 space-y-1.5">
                            {timers.map((t) => (
                              <li key={t} className="text-meta text-ink-muted">
                                {t}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="border-t border-line pt-4">
                        <p className="text-meta font-medium text-ink-muted">
                          Rules for both parties
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {rule.partyNotes.map((n) => (
                            <li key={n} className="flex gap-2 text-meta text-ink-muted">
                              <span aria-hidden className="text-ink-faint">
                                —
                              </span>
                              {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <Note>
                      This method&apos;s flow is not documented yet, so it cannot be
                      selected on a deal. It is listed here rather than hidden
                      because the source FAQ mentions it.
                    </Note>
                  )}
                </Card>
              ))}
            </section>
          </div>

          <aside className="space-y-4">
            <ImpersonationNotice />

            <Card className="space-y-3">
              <SectionTitle>Still stuck?</SectionTitle>
              <p className="text-body text-ink-muted">
                Open a support room and the team will pick it up. Support is
                separate from a deal room and carries no escrow.
              </p>
              <Link
                href="/support"
                className="inline-flex items-center gap-1.5 text-body font-medium text-accent-text underline underline-offset-2"
              >
                Open a support room
                <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
              </Link>
            </Card>

            <Card className="space-y-3">
              <SectionTitle>Jump to a method</SectionTitle>
              <ul className="space-y-1.5">
                {methods.map(({ rule }) => (
                  <li key={rule.id}>
                    <a
                      href={`#${rule.id.toLowerCase()}`}
                      className="text-meta text-ink-muted underline underline-offset-2 hover:text-ink"
                    >
                      {rule.label}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </PageBody>
    </AppShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-meta text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-meta text-ink">{value}</dd>
    </div>
  );
}
