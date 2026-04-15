"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { exportUserData, type UserExport } from "@/app/actions/account";

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CSV_HEADERS = ["date", "type", "amount", "category", "description"];

function escapeCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function transactionsToCsv(
  transactions: UserExport["transactions"]
): string {
  const rows = transactions.map((t) =>
    [
      escapeCell(t.created_at ? String(t.created_at).slice(0, 10) : ""),
      escapeCell(t.type),
      escapeCell(t.amount),
      escapeCell(t.category),
      escapeCell(t.description),
    ].join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

// ── Download trigger ──────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportDataButton() {
  const [loadingJson, setLoadingJson] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStamp = new Date().toISOString().slice(0, 10);

  async function handleExportJson() {
    setLoadingJson(true);
    setError(null);
    const result = await exportUserData();
    setLoadingJson(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    triggerDownload(
      JSON.stringify(result.data, null, 2),
      `reduvia-export-${dateStamp}.json`,
      "application/json"
    );
  }

  async function handleExportCsv() {
    setLoadingCsv(true);
    setError(null);
    const result = await exportUserData();
    setLoadingCsv(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    triggerDownload(
      transactionsToCsv(result.data.transactions),
      `reduvia-transactions-${dateStamp}.csv`,
      "text/csv"
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={handleExportJson}
          disabled={loadingJson || loadingCsv}
        >
          {loadingJson ? "Exporting…" : "Export as JSON"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={loadingJson || loadingCsv}
        >
          {loadingCsv ? "Exporting…" : "Export as CSV"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
