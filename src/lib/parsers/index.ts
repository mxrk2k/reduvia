/**
 * parsers/index.ts
 *
 * Public surface of the bank-statement parsing layer.
 *
 * Exports:
 *   ParsedTransaction  – one normalised row from any bank
 *   ParsedStatement    – full result returned by the parser
 *   parsePdfStatement  – parse a PDF Buffer (server-side only)
 */

// ── Shared types ──────────────────────────────────────────────────────────────

/** One normalised transaction row. */
export interface ParsedTransaction {
  /** ISO 8601 date string: YYYY-MM-DD */
  date: string;
  /** Raw description as it appears in the bank file. */
  description: string;
  /** Always a positive number; direction encoded in `type`. */
  amount: number;
  /** "income" = credit/deposit, "expense" = debit/charge */
  type: "income" | "expense";
}

/** Full result returned by the parser. */
export interface ParsedStatement {
  /** Detected bank name, or first line of PDF. */
  bankName: string;
  /** All transactions extracted from the file, in file order. */
  transactions: ParsedTransaction[];
  /** Earliest transaction date (ISO). */
  dateFrom: string;
  /** Latest transaction date (ISO). */
  dateTo: string;
  /** Account last 4 digits, if detectable. */
  accountLastFour?: string;
  /** Account type string, e.g. "Checking", "Credit Card". */
  accountType?: string;
  /** Beginning balance parsed from statement header. */
  beginningBalance?: number;
  /** Ending balance parsed from statement header. */
  endingBalance?: number;
  /** Human-readable statement period string from header. */
  statementPeriod?: string;
}

// ── Re-export ─────────────────────────────────────────────────────────────────

export { parsePdfStatement } from "./pdf-parser";
