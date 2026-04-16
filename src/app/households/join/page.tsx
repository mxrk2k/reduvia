import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/household";

interface JoinPageProps {
  searchParams: { token?: string };
}

export const metadata = { title: "Join Household — Reduvia" };

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const { token } = searchParams;

  if (!token) redirect("/households");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login, come back here after
    const returnUrl = encodeURIComponent(`/households/join?token=${token}`);
    redirect(`/login?returnUrl=${returnUrl}`);
  }

  const result = await acceptInvite(token);
  const success = !("error" in result) || !result.error;
  const errorMessage = "error" in result ? result.error : null;

  if (success) {
    redirect("/households");
  }

  // Show error page (token already used, already a member, etc.)
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center">
        {success ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="text-xl font-bold">You&apos;re in!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ve joined the household. You can now see and contribute to
              shared budgets.
            </p>
            <Link
              href="/households"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              View Household
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="text-xl font-bold">Couldn&apos;t join</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMessage ?? "This invite link is invalid or has already been used."}
            </p>
            <Link
              href="/households"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              Go to Households
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
