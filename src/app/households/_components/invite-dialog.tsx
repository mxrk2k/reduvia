"use client";

import { useState, useTransition } from "react";
import { UserPlus, Copy, Check, Link2 } from "lucide-react";
import { inviteMember } from "@/app/actions/household";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InviteDialogProps {
  householdId: string;
}

export function InviteDialog({ householdId }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setInviteUrl(null);
    setError(null);
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await inviteMember(householdId, email);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setInviteUrl("data" in result ? result.data.inviteUrl : "");
    });
  }

  function handleCopy() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Member</DialogTitle>
        </DialogHeader>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1.5 block text-sm font-medium"
              >
                Email address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                A shareable invite link will be generated. The person must have
                a Reduvia Pro account to join.
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || !email.trim()}
              >
                {isPending ? "Generating…" : "Generate Link"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="flex-1 truncate text-xs text-muted-foreground">
                {inviteUrl}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with{" "}
              <span className="font-medium text-foreground">{email}</span>. The
              link can only be used once.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  reset();
                }}
              >
                Invite Another
              </Button>
              <Button onClick={handleCopy} className="gap-1.5">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
