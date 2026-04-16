import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSavingsGoals } from "@/app/actions/savings-goals";
import { ThemeToggle } from "@/components/theme-toggle";
import { SavingsGoalsList } from "./_components/savings-goals-list";
import { CreateGoalDialog } from "./_components/create-goal-dialog";

export default async function SavingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const goals = await getSavingsGoals();

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <h1 className="text-base font-semibold sm:text-lg">Savings Goals</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl space-y-6 p-4 pt-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your Goals</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {goals.length === 0
                ? "Set a goal to start tracking your savings."
                : `${goals.length} goal${goals.length !== 1 ? "s" : ""} tracked`}
            </p>
          </div>
          <CreateGoalDialog />
        </div>

        <SavingsGoalsList goals={goals} />
      </main>
    </div>
  );
}
