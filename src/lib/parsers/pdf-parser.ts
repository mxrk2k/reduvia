/**
 * pdf-parser.ts
 *
 * AI-powered bank statement PDF parser.
 *
 * Strategy:
 *   1. Extract raw text from the PDF via pdf-parse.
 *   2. Send the text to Claude with a structured prompt.
 *   3. Parse Claude's JSON response into ParsedStatement.
 *
 * Works for any bank because Claude understands context naturally —
 * no regex patterns or bank-specific heuristics required.
 *
 * SETUP: Add ANTHROPIC_API_KEY to your environment variables.
 *   - Local: add to .env.local
 *   - Vercel: Settings → Environment Variables → ANTHROPIC_API_KEY
 *
 * NOTE: Server-side only. next.config.mjs must list 'pdf-parse' in
 *       experimental.serverComponentsExternalPackages.
 */

import Anthropic from "@anthropic-ai/sdk";
import pdfParse from "pdf-parse";

import type { ParsedStatement, ParsedTransaction } from "./index";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AiTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

interface AiResponse {
  bankName: string;
  accountType: string | null;
  accountLastFour: string | null;
  dateFrom: string;
  dateTo: string;
  statementPeriod: string | null;
  beginningBalance: number | null;
  endingBalance: number | null;
  transactions: AiTransaction[];
}

// ── AI parsing ────────────────────────────────────────────────────────────────

async function parseWithAI(pdfText: string): Promise<AiResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI parsing failed. Please ensure ANTHROPIC_API_KEY is configured."
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a bank statement parser. Extract all transactions from this bank statement text and return ONLY a JSON object with no other text, markdown, or explanation.

The JSON must have this exact structure:
{
  "bankName": "string (e.g. Chase, Bank of America, AMEX)",
  "accountType": "string or null (e.g. Checking, Savings, Credit Card)",
  "accountLastFour": "string or null (last 4 digits of account)",
  "dateFrom": "YYYY-MM-DD (earliest transaction date)",
  "dateTo": "YYYY-MM-DD (latest transaction date)",
  "statementPeriod": "string or null (e.g. December 19, 2025 through January 22, 2026)",
  "beginningBalance": number or null,
  "endingBalance": number or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "clean readable description",
      "amount": number (POSITIVE for all transactions — direction is in type),
      "type": "income" or "expense",
      "category": one of: "housing", "food", "transport", "utilities", "health", "entertainment", "shopping", "education", "salary", "freelance", "investment", "other"
    }
  ]
}

IMPORTANT RULES:
- amount must always be POSITIVE. Use the "type" field for direction ("income" or "expense").
- amount must be the TRANSACTION amount, NOT the running balance.
- For Chase statements: lines ending with two concatenated numbers like "-35.893,750.21" mean amount=35.89 and balance=3750.21 (ignore the balance).
- Do not include "Beginning Balance" or "Ending Balance" as transactions.
- Return ONLY the JSON object, no markdown code blocks, no explanation.

Bank statement text:
${pdfText.slice(0, 12000)}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude.");
  }

  // Strip any accidental markdown fences Claude might add
  const jsonText = content.text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(jsonText) as AiResponse;
}

// ── Validation / normalisation ────────────────────────────────────────────────

function normaliseTransaction(t: AiTransaction): ParsedTransaction {
  return {
    date:        t.date,
    description: String(t.description).trim() || "Transaction",
    amount:      Math.abs(Number(t.amount)),
    type:        t.type === "income" ? "income" : "expense",
  };
}

function validateResponse(data: AiResponse): void {
  if (!data.bankName) throw new Error("AI response missing bankName.");
  if (!Array.isArray(data.transactions)) throw new Error("AI response missing transactions array.");
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function parsePdfStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
  // Step 1: extract raw text
  const result = await pdfParse(pdfBuffer);
  const pdfText = result.text;

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error(
      "PDF appears to be image-only (no extractable text). " +
      "Please ensure it is a text-based PDF bank statement, not a scanned image."
    );
  }

  // Step 2: AI parsing — no fallback, surface the error clearly
  let aiData: AiResponse;
  try {
    aiData = await parseWithAI(pdfText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`AI parsing failed. ${msg}`);
  }

  validateResponse(aiData);

  // Step 3: normalise and filter transactions
  const transactions: ParsedTransaction[] = aiData.transactions
    .map(normaliseTransaction)
    .filter((t) => t.amount > 0 && t.amount <= 100_000);

  if (transactions.length < 1) {
    throw new Error(
      "Could not parse transactions from this PDF. " +
      "Please ensure it is a text-based (not scanned) bank statement PDF."
    );
  }

  console.log(
    `[pdf-parser] ${aiData.bankName} — ${transactions.length} transactions parsed via AI`
  );
  console.log("[pdf-parser] First 10:", transactions.slice(0, 10));

  // Step 4: derive date range from transactions if AI didn't supply them
  const dates = transactions.map((t) => t.date).sort();
  const dateFrom = aiData.dateFrom || dates[0];
  const dateTo   = aiData.dateTo   || dates[dates.length - 1];

  return {
    bankName:         aiData.bankName,
    transactions,
    dateFrom,
    dateTo,
    accountLastFour:  aiData.accountLastFour  ?? undefined,
    accountType:      aiData.accountType      ?? undefined,
    beginningBalance: aiData.beginningBalance ?? undefined,
    endingBalance:    aiData.endingBalance    ?? undefined,
    statementPeriod:  aiData.statementPeriod  ?? undefined,
  };
}
