"use client";

import { useState, useEffect } from "react";
import { Gift, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getReferralStats, generateReferralCode } from "@/app/actions/referrals";
import type { ReferralStats } from "@/app/actions/referrals";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setStats(null);

    getReferralStats().then(async (data) => {
      if (!data) { setLoading(false); return; }

      // Auto-generate code on first open if the user doesn't have one yet.
      if (!data.code) {
        const code = await generateReferralCode();
        setStats({ ...data, code });
      } else {
        setStats(data);
      }
      setLoading(false);
    });
  }, [open]);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://reduvia.vercel.app";
  const referralLink = stats?.code ? `${origin}/signup?ref=${stats.code}` : "";

  async function handleCopy() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <DialogTitle>Invite Friends</DialogTitle>
          </div>
          <DialogDescription>
            Share your link and help friends take control of their finances.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Referral link */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Your invite link
              </p>
              <div className="flex items-center gap-2">
                {/* min-w-0 lets the flex child shrink below its content width so truncate works */}
                <div className="flex-1 min-w-0 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground truncate">
                  {referralLink || "Generating link…"}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={!referralLink}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {stats?.invited ?? 0}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Friends invited</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {stats?.completed ?? 0}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Signed up</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
