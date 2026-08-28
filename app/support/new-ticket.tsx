"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { openTicket } from "./actions";
import {
  Button,
  FormError,
  Hint,
  Input,
  Label,
  Note,
  Select,
  Textarea,
} from "@/components/ui";
import { Modal } from "@/components/modal";
import { SUPPORT_CATEGORY_HINT, SUPPORT_CATEGORY_LABEL } from "@/lib/report-meta";
import type { SupportCategory } from "@prisma/client";

const CATEGORIES: SupportCategory[] = [
  "GENERAL_HELP",
  "ACCOUNT_ISSUE",
  "ADS_PREMIUM",
  "REPORT_PROBLEM",
];

export function NewTicketButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("GENERAL_HELP");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await openTicket({
        category,
        subject: subject.trim(),
        body: body.trim(),
      });
      if (!res.ok) setError(res.error);
      else router.push(`/support/${res.ticketId}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-[18px]" strokeWidth={2.25} />
        Open a room
      </Button>

      {open ? (
        <Modal
          title="Open a support room"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button form="ticket-form" type="submit" pending={pending}>
                {pending ? "Opening…" : "Open room"}
              </Button>
            </>
          }
        >
          <form id="ticket-form" onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ticket-category">Category</Label>
              <Select
                id="ticket-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUPPORT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
              <Hint>{SUPPORT_CATEGORY_HINT[category]}</Hint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-subject">Subject</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                maxLength={160}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-body">What do you need?</Label>
              <Textarea
                id="ticket-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                maxLength={4000}
              />
            </div>

            <Note>
              This is not a deal room. No escrow, no payment proofs — never send
              funds, a private key, or a password here.
            </Note>

            <FormError message={error} />
          </form>
        </Modal>
      ) : null}
    </>
  );
}
