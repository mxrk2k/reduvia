import { inngest } from "@/lib/inngest";
import { createAdminClient } from "@/lib/supabase/admin";
import { categorizeTransactions } from "@/app/actions/bank-statements";
import { captureServerEvent } from "@/lib/posthog";
import type { ParsedTransaction } from "@/lib/parsers";

interface ProcessBankStatementData {
  userId: string;
  bankAccountId: string;
  statementId: string;
  rawTransactions: ParsedTransaction[];
  bankName: string;
}

export const processBankStatement = inngest.createFunction(
  {
    id: "process-bank-statement",
    triggers: [{ event: "bank-statement/process" }],
    onFailure: async ({ event }: { event: { data: { event: { data: ProcessBankStatementData } } } }) => {
      const { bankAccountId, userId } = event.data.event.data;
      const supabase = createAdminClient();
      await supabase
        .from("bank_accounts")
        .update({ processing_status: "failed" })
        .eq("id", bankAccountId)
        .eq("user_id", userId);
    },
  },
  async ({ event, step }: { event: { data: ProcessBankStatementData }; step: { run: <T>(id: string, fn: () => Promise<T> | T) => Promise<T> } }) => {
    const { userId, bankAccountId, statementId, rawTransactions, bankName } = event.data;
    const supabase = createAdminClient();

    await step.run("set-processing", () =>
      supabase
        .from("bank_accounts")
        .update({ processing_status: "processing" })
        .eq("id", bankAccountId)
        .eq("user_id", userId)
    );

    const categorized = await step.run("categorize-transactions", () =>
      categorizeTransactions(rawTransactions)
    );

    await step.run("save-transactions", async () => {
      const rows = categorized.map((t) => ({
        user_id:           userId,
        bank_account_id:   bankAccountId,
        statement_id:      statementId,
        date:              t.date,
        description:       t.description,
        clean_description: t.clean_description,
        amount:            t.amount,
        type:              t.type,
        category:          t.category,
      }));

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await supabase
          .from("bank_transactions")
          .insert(rows.slice(i, i + CHUNK));
        if (error) throw new Error(`Failed to insert transactions: ${error.message}`);
      }

      await supabase
        .from("imported_statements")
        .update({ transaction_count: categorized.length })
        .eq("id", statementId);
    });

    await step.run("set-completed", () =>
      supabase
        .from("bank_accounts")
        .update({ processing_status: "completed" })
        .eq("id", bankAccountId)
        .eq("user_id", userId)
    );

    await step.run("analytics", () =>
      captureServerEvent(userId, "bank_statement_imported", {
        bank_name:         bankName,
        transaction_count: categorized.length,
      })
    );
  }
);
