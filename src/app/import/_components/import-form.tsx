"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { importBankStatement } from "@/app/actions/bank-statements";
import { RecurringSuggestions } from "@/components/recurring-suggestions";
import type { ImportResult } from "@/app/actions/bank-statements";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateRange(from: string, to: string): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(from)} – ${fmt(to)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportForm({ isPro }: { isPro: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── File selection ───────────────────────────────────────────────────────

  function selectFile(chosen: File | null) {
    if (!chosen) return;
    setFile(chosen);
    setResult(null);
    setErrorMsg(null);
  }

  function clearFile() {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0] ?? null;
    selectFile(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ───────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!file) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await importBankStatement(formData);
        setResult(res);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
        );
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  // ── Success state ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div>
              <h3 className="text-lg font-semibold">Import successful!</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Your statement has been imported and categorized.
              </p>
            </div>

            {/* Result summary */}
            <div className="w-full max-w-sm rounded-lg border bg-muted/40 px-5 py-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium">{result.bankName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transactions</span>
                <span className="font-medium tabular-nums">{result.transactionCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date range</span>
                <span className="font-medium tabular-nums text-right">
                  {formatDateRange(result.dateFrom, result.dateTo)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-sm sm:flex-row">
              <Link
                href={`/bank/${result.bankAccountId}`}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground whitespace-nowrap transition-all hover:bg-primary/80 h-8"
              >
                View Analysis
              </Link>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setResult(null);
                  setErrorMsg(null);
                }}
              >
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recurring suggestions — only rendered when detection found patterns */}
        {result.recurringSuggestions.length > 0 && (
          <RecurringSuggestions
            suggestions={result.recurringSuggestions}
            isPro={isPro}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="PDF file upload area. Click or drag a PDF file here."
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !file && inputRef.current?.click()}
        className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 transition-colors sm:min-h-[200px] ${
          isDragging
            ? "border-primary bg-primary/5"
            : file
            ? "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-900/10 cursor-default"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
        />

        {file ? (
          /* File selected */
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="w-full max-w-full truncate text-center text-sm font-medium">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          /* Empty state */
          <>
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                isDragging ? "bg-primary/10" : "bg-muted"
              }`}
            >
              <Upload className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragging ? "Drop your file here" : "Drag & drop or click to browse"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload your bank statement in PDF format
              </p>
            </div>
          </>
        )}
      </div>

      {/* Supported banks note */}
      <p className="text-center text-xs text-muted-foreground">
        Supports Chase, AMEX, Bank of America, Wells Fargo, Citi, Capital One, and most other banks
      </p>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Submit button */}
      <Button
        className="w-full"
        disabled={!file || isPending}
        onClick={handleSubmit}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing transactions with AI...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Import Statement
          </>
        )}
      </Button>

      {isPending && (
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          This may take a moment while we categorize your transactions with AI.
        </p>
      )}
    </div>
  );
}
