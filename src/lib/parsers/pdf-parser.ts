/**
 * pdf-parser.ts
 *
 * Universal bank statement PDF parser with Chase-specific optimizations.
 *
 * Strategy:
 *   1. Extract text via pdf-parse.
 *   2. Detect bank name, account info, balances, and date range from header text.
 *   3. Try 6 transaction extraction patterns; use the one yielding the most results.
 *   4. Chase optimization: infer year from statement dates (handles Dec–Jan crossover).
 *   5. Universal income/expense detection via amount sign + description keywords.
 *
 * NOTE: Server-side only. next.config.mjs must list 'pdf-parse' in serverExternalPackages.
 */

import pdfParse from "pdf-parse";

import type { ParsedStatement, ParsedTransaction } from "./index";

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Known bank name detectors — checked against the first 4 000 chars of text. */
const KNOWN_BANKS: { pattern: RegExp; name: string }[] = [
  { pattern: /american\s+express|amex\.com/i,                   name: "American Express" },
  { pattern: /jpmorgan\s+chase|chase\s+bank|chase\.com/i,       name: "Chase" },
  { pattern: /bank\s+of\s+america|bankofamerica\.com/i,         name: "Bank of America" },
  { pattern: /wells\s+fargo|wellsfargo\.com/i,                  name: "Wells Fargo" },
  { pattern: /citibank|citi\s+bank|citi\.com|citicards/i,       name: "Citibank" },
  { pattern: /capital\s+one|capitalone\.com/i,                  name: "Capital One" },
  { pattern: /td\s+bank|tdbank\.com/i,                          name: "TD Bank" },
  { pattern: /pnc\s+bank|pnc\.com/i,                           name: "PNC" },
  { pattern: /u\.?s\.?\s+bank|usbank\.com/i,                   name: "US Bank" },
  { pattern: /discover\s+bank|discover\.com/i,                 name: "Discover" },
  { pattern: /navy\s+federal/i,                                name: "Navy Federal" },
  { pattern: /ally\s+bank|ally\.com/i,                         name: "Ally" },
  { pattern: /truist/i,                                        name: "Truist" },
  { pattern: /regions\s+bank|regions\.com/i,                   name: "Regions" },
  { pattern: /suntrust/i,                                      name: "SunTrust" },
  { pattern: /bb&t|bbt\s+bank/i,                               name: "BB&T" },
  { pattern: /fifth\s+third/i,                                 name: "Fifth Third" },
];

/** Lines that are never transactions — applied before all patterns. */
const SKIP_LINE_RES: RegExp[] = [
  /^\s*(?:beginning|opening|previous)\s+balance/i,
  /^\s*(?:ending|closing|new)\s+balance/i,
  /^\s*statement\s+balance/i,
  /^\s*transaction\s+detail/i,
  /^\s*(?:checking|savings|account)\s+summary/i,
  /^\s*(?:deposits?\s+and\s+additions?|withdrawals?|checks?\s+paid)/i,
  /^\s*date\s+(?:description|amount|transaction)/i,
  /^\s*page\s+\d+\b/i,
  /^\s*\d+\s+of\s+\d+\s*$/,
  /^\s*subtotal\b/i,
  /^\s*(?:grand\s+)?total\b/i,
  /^\s*minimum\s+(?:payment|due)/i,
  /^\s*payment\s+due\s+date/i,
  /^\s*credit\s+limit/i,
  /^\s*available\s+credit/i,
  /^\s*interest\s+charge[sd]?\s+calculation/i,
  /^\s*annual\s+percentage\s+rate/i,
  /^\s*account\s+number\b/i,
];

/** Description substrings that indicate income (credit/deposit). */
const INCOME_RE =
  /\b(deposit|payment\s+received|refund|return|zelle\s+from|transfer\s+from|direct\s+deposit|payroll|salary|moneygram|dailypay|venmo\s+from|cashapp\s+from|reimburs|rebate|reward|cashback|interest\s+paid|dividends?|credit\s+applied)\b/i;

/** Description substrings that indicate expense (debit/charge). */
const EXPENSE_RE =
  /\b(purchase|withdrawal|payment\s+to|zelle\s+to|transfer\s+to|card\s+purchase|recurring\s+card|atm\s+withdrawal|overdraft|fee|charge|debit|check\s+paid|bill\s+pay(?:ment)?|wire\s+transfer|auto\s+pay|subscription)\b/i;

// ── Internal types ────────────────────────────────────────────────────────────

interface StatementMeta {
  bankName: string;
  /** True for AMEX-type accounts where positive amount = expense. */
  isAmex: boolean;
  accountLastFour?: string;
  accountType?: string;
  beginningBalance?: number;
  endingBalance?: number;
  statementPeriod?: string;
  headerDateFrom?: string;
  headerDateTo?: string;
  headerFromYear?: number;
  headerFromMonth?: number;
  headerToYear?: number;
  headerToMonth?: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function monthNum(name: string): string | null {
  return MONTH_NAMES[name.toLowerCase()] ?? null;
}

/**
 * Parse "Month DD, YYYY" or "Month DD YYYY" (with any whitespace) → "YYYY-MM-DD" or null.
 */
function parseLongDate(raw: string): string | null {
  // Normalize all whitespace runs to a single space and trim
  const s = raw.replace(/\s+/g, " ").trim();
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!m) return null;
  const mm = monthNum(m[1]);
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
}

/** Parse MM/DD/YYYY or MM/DD/YY → "YYYY-MM-DD" or null. */
function parseMDY(raw: string): string | null {
  const s = raw.trim();
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) return `${m4[3]}-${m4[1].padStart(2, "0")}-${m4[2].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  return null;
}

/**
 * Infer the full year for an MM/DD date, correctly handling Dec–Jan crossover.
 *
 * For a statement covering Dec 19 2025 – Jan 22 2026:
 *   headerFromYear=2025, headerFromMonth=12, headerToYear=2026, headerToMonth=1
 *
 *   month=12 (Dec): 12 <= 1 → false → headerFromYear (2025) ✓
 *   month=1  (Jan):  1 <= 1 → true  → headerToYear   (2026) ✓
 *   month=6  (Jun):  6 <= 1 → false → headerFromYear (2025) ✓  (would be mid-year, shouldn't occur)
 */
function inferYearForMD(month: number, meta: StatementMeta): number {
  if (meta.headerToYear === undefined) return new Date().getFullYear();
  if (
    meta.headerFromYear !== undefined &&
    meta.headerToYear !== meta.headerFromYear
  ) {
    // Cross-year statement: months ≤ toMonth belong to toYear, rest to fromYear
    return month <= (meta.headerToMonth ?? 12)
      ? meta.headerToYear
      : meta.headerFromYear;
  }
  return meta.headerToYear;
}

/**
 * Parse a date token (MM/DD, MM/DD/YY, MM/DD/YYYY).
 * For two-part dates uses year inference from statement header.
 */
function parseDateToken(token: string, meta: StatementMeta): string | null {
  const iso = parseMDY(token);
  if (iso) return iso;

  const md = token.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md) {
    const month = parseInt(md[1], 10);
    const year  = inferYearForMD(month, meta);
    return `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
  }
  return null;
}

// ── Amount helper ─────────────────────────────────────────────────────────────

/**
 * Parse "$1,234.56", "-1,234.56", "(1,234.56)", "1234.56" → number or null.
 * Uses [\d,]+ so thousands separators are optional.
 */
function parseMoney(raw: string): number | null {
  const s = raw.trim();
  const negative =
    (s.startsWith("(") && s.endsWith(")")) ||
    s.startsWith("-") ||
    s.startsWith("−");
  const cleaned = s.replace(/[()$,\s\-−]/g, "");
  const v = parseFloat(cleaned);
  if (isNaN(v)) return null;
  return negative ? -v : v;
}

// ── Income / expense determination ────────────────────────────────────────────

function determineType(
  description: string,
  amount: number,
  isAmex: boolean
): "income" | "expense" {
  if (amount < 0) return isAmex ? "income" : "expense";
  if (INCOME_RE.test(description))  return "income";
  if (EXPENSE_RE.test(description)) return "expense";
  return isAmex ? "expense" : "income";
}

// ── Line skip check ───────────────────────────────────────────────────────────

function shouldSkip(line: string): boolean {
  return SKIP_LINE_RES.some((re) => re.test(line));
}

// ── Meta extraction ───────────────────────────────────────────────────────────

function extractMeta(text: string): StatementMeta {
  const header = text.slice(0, 4000);

  // ── Bank name ──────────────────────────────────────────────────────────────
  let bankName = "";
  for (const b of KNOWN_BANKS) {
    if (b.pattern.test(header)) { bankName = b.name; break; }
  }
  if (!bankName) {
    const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 2);
    bankName = firstLine ?? "Unknown Bank";
  }

  // ── Account type ──────────────────────────────────────────────────────────
  let accountType: string | undefined;
  for (const [re, label] of [
    [/credit\s+card/i, "Credit Card"],
    [/checking/i,      "Checking"],
    [/savings/i,       "Savings"],
    [/money\s+market/i,"Money Market"],
    [/debit/i,         "Debit"],
  ] as [RegExp, string][]) {
    if (re.test(header)) { accountType = label; break; }
  }

  // ── Account last four ─────────────────────────────────────────────────────
  const lastFourMatch = text.match(
    /(?:card|account|ending\s+in|ending)\s*(?:number:?)?\s*\*{0,4}(\d{4})\b/i
  );
  const accountLastFour = lastFourMatch?.[1];

  // ── Balances ──────────────────────────────────────────────────────────────
  const begBalMatch = text.match(
    /(?:beginning|previous|opening)\s+balance\s+\$?([\d,]+\.\d{2})/i
  );
  const endBalMatch = text.match(
    /(?:ending|closing|new)\s+balance\s+\$?([\d,]+\.\d{2})/i
  );
  const beginningBalance = begBalMatch ? parseMoney(begBalMatch[1]) ?? undefined : undefined;
  const endingBalance    = endBalMatch  ? parseMoney(endBalMatch[1])  ?? undefined : undefined;

  // ── Statement period & date range ─────────────────────────────────────────
  // Try multiple patterns against the FULL text (not just header).
  let statementPeriod: string | undefined;
  let headerDateFrom: string | undefined;
  let headerDateTo: string | undefined;

  // Pattern A: "Month DD, YYYY through Month DD, YYYY"  — Chase long form.
  // Use \s+ everywhere to handle PDF whitespace quirks.
  const chaseRange = text.match(
    /([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+through\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
  );
  if (chaseRange) {
    const from = parseLongDate(chaseRange[1]);
    const to   = parseLongDate(chaseRange[2]);
    if (from && to) {
      headerDateFrom  = from;
      headerDateTo    = to;
      statementPeriod = `${chaseRange[1].replace(/\s+/g, " ").trim()} through ${chaseRange[2].replace(/\s+/g, " ").trim()}`;
    }
  }

  // Pattern B: "From: Month DD, YYYY To: Month DD, YYYY"
  if (!headerDateFrom) {
    const fromTo = text.match(
      /from:?\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+to:?\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
    );
    if (fromTo) {
      const from = parseLongDate(fromTo[1]);
      const to   = parseLongDate(fromTo[2]);
      if (from && to) {
        headerDateFrom  = from;
        headerDateTo    = to;
        statementPeriod = `${fromTo[1].trim()} to ${fromTo[2].trim()}`;
      }
    }
  }

  // Pattern C: "MM/DD/YYYY to MM/DD/YYYY" or "MM/DD/YYYY - MM/DD/YYYY"
  if (!headerDateFrom) {
    const mdyRange = text.match(
      /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
    );
    if (mdyRange) {
      const from = parseMDY(mdyRange[1]);
      const to   = parseMDY(mdyRange[2]);
      if (from && to) {
        headerDateFrom  = from;
        headerDateTo    = to;
        statementPeriod = `${mdyRange[1]} to ${mdyRange[2]}`;
      }
    }
  }

  // Pattern D: "Opening Date MM/DD/YY" + "Closing Date MM/DD/YY" (Chase alternate)
  if (!headerDateFrom) {
    const openMatch  = text.match(/opening\s+date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const closeMatch = text.match(/closing\s+date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (openMatch && closeMatch) {
      const from = parseMDY(openMatch[1]);
      const to   = parseMDY(closeMatch[1]);
      if (from && to) {
        headerDateFrom  = from;
        headerDateTo    = to;
        statementPeriod = `${openMatch[1]} to ${closeMatch[1]}`;
      }
    }
  }

  // Pattern E: "Statement Period: Month YYYY" (month-only, for period label)
  if (!statementPeriod) {
    const periodMatch = text.match(/statement\s+period:?\s+([A-Za-z]+\s+\d{4})/i);
    if (periodMatch) statementPeriod = periodMatch[1];
  }

  // Decompose header dates for year inference
  let headerFromYear: number | undefined;
  let headerFromMonth: number | undefined;
  let headerToYear: number | undefined;
  let headerToMonth: number | undefined;
  if (headerDateFrom) {
    const [fy, fm] = headerDateFrom.split("-").map(Number);
    headerFromYear  = fy;
    headerFromMonth = fm;
  }
  if (headerDateTo) {
    const [ty, tm] = headerDateTo.split("-").map(Number);
    headerToYear  = ty;
    headerToMonth = tm;
  }

  const isAmex =
    /american\s+express|amex/i.test(bankName) ||
    accountType === "Credit Card";

  return {
    bankName,
    isAmex,
    accountLastFour,
    accountType,
    beginningBalance,
    endingBalance,
    statementPeriod,
    headerDateFrom,
    headerDateTo,
    headerFromYear,
    headerFromMonth,
    headerToYear,
    headerToMonth,
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Amount regex that handles both comma-formatted ("4,010.86") and plain ("4010.86") numbers.
 * Using [\d,]+ instead of \d{1,3}(?:,\d{3})* so thousands separators are optional.
 */
const AMT = String.raw`[-−]?[\d,]+\.\d{2}`;
const AMT_POS = String.raw`[\d,]+\.\d{2}`;   // positive-only variant (no sign)

function buildTxn(
  rawDate: string,
  description: string,
  rawAmount: string,
  meta: StatementMeta
): ParsedTransaction | null {
  const desc = description.trim();
  if (!desc || shouldSkip(desc)) return null;

  const date   = parseDateToken(rawDate.trim(), meta);
  const amount = parseMoney(rawAmount);
  if (!date || amount === null) return null;

  return {
    date,
    description: desc,
    amount:      Math.abs(amount),
    type:        determineType(desc, amount, meta.isAmex),
  };
}

function prepareLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !shouldSkip(l));
}

// ── Six transaction extraction patterns ──────────────────────────────────────

/**
 * Pattern 1 — Chase / trailing-balance format: MM/DD  DESCRIPTION  AMOUNT  BALANCE
 *
 * The key fix: use [\d,]+\.\d{2} for both AMOUNT and BALANCE so numbers without
 * thousands separators (e.g., "4010.86") still match.  The BALANCE (last number)
 * is captured but discarded — only AMOUNT (second-to-last) is used.
 */
function extractPattern1(text: string, meta: StatementMeta): ParsedTransaction[] {
  const re = new RegExp(
    String.raw`^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(${AMT})\s+${AMT_POS}\s*$`,
    "gm"
  );
  const txns: ParsedTransaction[] = [];
  for (const m of Array.from(text.matchAll(re))) {
    const t = buildTxn(m[1], m[2], m[3], meta);
    if (t) txns.push(t);
  }
  return txns;
}

/**
 * Pattern 2 — Full date, single amount at end: MM/DD/YYYY  DESCRIPTION  [$]AMOUNT
 */
function extractPattern2(text: string, meta: StatementMeta): ParsedTransaction[] {
  const re = new RegExp(
    String.raw`^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s+(\$?${AMT})\s*$`,
    "gm"
  );
  const txns: ParsedTransaction[] = [];
  for (const m of Array.from(text.matchAll(re))) {
    const t = buildTxn(m[1], m[2], m[3], meta);
    if (t) txns.push(t);
  }
  return txns;
}

/**
 * Pattern 3 — Bank of America / Wells Fargo: MM/DD/YYYY  DESCRIPTION  AMOUNT  [BALANCE]
 */
function extractPattern3(text: string, meta: StatementMeta): ParsedTransaction[] {
  const re = new RegExp(
    String.raw`^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(${AMT})(?:\s+${AMT_POS})?\s*$`,
    "gm"
  );
  const txns: ParsedTransaction[] = [];
  for (const m of Array.from(text.matchAll(re))) {
    const t = buildTxn(m[1], m[2], m[3], meta);
    if (t) txns.push(t);
  }
  return txns;
}

/**
 * Pattern 4 — AMEX style: MM/DD/YY  DESCRIPTION  AMOUNT
 */
function extractPattern4(text: string, meta: StatementMeta): ParsedTransaction[] {
  const re = new RegExp(
    String.raw`^(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(${AMT})\s*$`,
    "gm"
  );
  const txns: ParsedTransaction[] = [];
  for (const m of Array.from(text.matchAll(re))) {
    const t = buildTxn(m[1], m[2], m[3], meta);
    if (t) txns.push(t);
  }
  return txns;
}

/**
 * Pattern 5 — Positive-first two-column: date, description, +amount, balance.
 * Used when withdrawals are shown without a negative sign.
 */
function extractPattern5(text: string, meta: StatementMeta): ParsedTransaction[] {
  const re = new RegExp(
    String.raw`^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(${AMT_POS})\s+${AMT_POS}\s*$`,
    "gm"
  );
  const txns: ParsedTransaction[] = [];
  for (const m of Array.from(text.matchAll(re))) {
    const t = buildTxn(m[1], m[2], m[3], meta);
    if (t) txns.push(t);
  }
  return txns;
}

/**
 * Pattern 6 — Generic fallback.
 * Scans each trimmed line for a date token and the FIRST amount token after it.
 * The first amount is the transaction amount; anything after is ignored (balance, etc.).
 */
function extractPattern6(text: string, meta: StatementMeta): ParsedTransaction[] {
  const DATE_TOKEN  = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/;
  const AMOUNT_TOKEN = /([-−]?\$?[\d,]+\.\d{2})/;

  const txns: ParsedTransaction[] = [];
  const lines = prepareLines(text);

  for (const line of lines) {
    const dateMatch = line.match(DATE_TOKEN);
    if (!dateMatch) continue;

    const afterDate = line.slice(dateMatch.index! + dateMatch[0].length).trim();
    const amtMatch  = afterDate.match(AMOUNT_TOKEN);
    if (!amtMatch) continue;

    const desc   = afterDate.slice(0, amtMatch.index).trim() || "Transaction";
    const amount = parseMoney(amtMatch[1]);
    if (amount === null || amount === 0) continue;

    const date =
      parseDateToken(dateMatch[1], meta) ??
      parseLongDate(dateMatch[1]);
    if (!date) continue;

    if (shouldSkip(desc)) continue;

    txns.push({
      date,
      description: desc,
      amount:      Math.abs(amount),
      type:        determineType(desc, amount, meta.isAmex),
    });
  }
  return txns;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicate(txns: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  return txns.filter((t) => {
    const key = `${t.date}|${t.description}|${t.amount}|${t.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Best-pattern selector ─────────────────────────────────────────────────────

function extractTransactions(text: string, meta: StatementMeta): ParsedTransaction[] {
  const candidates: ParsedTransaction[][] = [
    extractPattern1(text, meta),
    extractPattern2(text, meta),
    extractPattern3(text, meta),
    extractPattern4(text, meta),
    extractPattern5(text, meta),
    extractPattern6(text, meta),
  ];

  // Pick the pattern with the most results; ties go to the lower index (more specific).
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].length > best.length) best = candidates[i];
  }

  return deduplicate(best);
}

// ── Date range from transactions ──────────────────────────────────────────────

function dateRange(
  txns: ParsedTransaction[],
  meta: StatementMeta
): { dateFrom: string; dateTo: string } {
  if (txns.length > 0) {
    const sorted = txns.map((t) => t.date).sort();
    return { dateFrom: sorted[0], dateTo: sorted[sorted.length - 1] };
  }
  const now = new Date().toISOString().slice(0, 10);
  return {
    dateFrom: meta.headerDateFrom ?? now,
    dateTo:   meta.headerDateTo   ?? now,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function parsePdfStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
  const result = await pdfParse(pdfBuffer);
  const text   = result.text;

  if (!text || text.trim().length === 0) {
    throw new Error(
      "PDF appears to be image-only (no extractable text). " +
      "Please ensure it is a text-based PDF bank statement, not a scanned image."
    );
  }

  const meta         = extractMeta(text);
  const transactions = extractTransactions(text, meta);

  if (transactions.length === 0) {
    throw new Error(
      "Could not parse transactions from this PDF. " +
      "Please ensure it is a text-based PDF bank statement, not a scanned image."
    );
  }

  const { dateFrom, dateTo } = dateRange(transactions, meta);

  return {
    bankName:         meta.bankName,
    transactions,
    dateFrom,
    dateTo,
    accountLastFour:  meta.accountLastFour,
    accountType:      meta.accountType,
    beginningBalance: meta.beginningBalance,
    endingBalance:    meta.endingBalance,
    statementPeriod:  meta.statementPeriod,
  };
}
