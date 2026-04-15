import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/stripe";
import { ThemeToggle } from "@/components/theme-toggle";
import { ImportForm } from "./_components/import-form";

export const metadata = { title: "Import Bank Statement" };

export default async function ImportPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isPro = await isProUser(user.id);

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <h1 className="text-base font-semibold sm:text-lg">Import Statement</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl space-y-6 p-4 pt-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Import Bank Statement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your bank statement in PDF format. Transactions are automatically categorized with AI.
          </p>
        </div>

        <ImportForm isPro={isPro} />
      </main>
    </div>
  );
}
