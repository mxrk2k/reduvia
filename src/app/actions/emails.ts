"use server";

import { getResendClient } from "@/lib/resend";

// ── Config ────────────────────────────────────────────────────────────────────

const FROM    = process.env.RESEND_FROM_EMAIL ?? "Reduvia <noreply@reduvia.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://reduvia.com";

// ── Shared HTML primitives ────────────────────────────────────────────────────

/** Outer shell: dark background, centred single-column layout. */
function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Reduvia</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="max-width:560px;width:100%;background-color:#111111;border-radius:16px;border:1px solid rgba(139,92,246,0.22);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Reduvia</p>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.5px;text-transform:uppercase;">Personal Finance</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;">
                © ${new Date().getFullYear()} Reduvia · All rights reserved<br />
                <a href="${APP_URL}" style="color:rgba(139,92,246,0.7);text-decoration:none;">reduvia.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Violet CTA button. */
function ctaButton(label: string, href: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
      <tr>
        <td style="border-radius:8px;background:linear-gradient(135deg,#7c3aed 0%,#2563eb 100%);">
          <a href="${href}"
            style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:-0.1px;">
            ${label} →
          </a>
        </td>
      </tr>
    </table>`;
}

/** A labelled stat box used in the monthly summary. */
function statBox(label: string, value: string, color: string): string {
  return `
    <td style="width:33%;padding:16px;text-align:center;background-color:#1a1a1a;border-radius:10px;">
      <p style="margin:0;color:${color};font-size:22px;font-weight:700;letter-spacing:-0.5px;">${value}</p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
    </td>`;
}

/** Feature list item with a violet check. */
function featureItem(text: string): string {
  return `
    <tr>
      <td style="padding:6px 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:22px;vertical-align:top;padding-top:1px;">
              <span style="color:#7c3aed;font-size:15px;">✓</span>
            </td>
            <td style="color:rgba(255,255,255,0.8);font-size:14px;line-height:1.5;">${text}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

// ── sendWelcomeEmail ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  name: string | null
): Promise<void> {
  const resend      = getResendClient();
  if (!resend) return;

  const greeting    = name ? `Hi ${name}` : "Hi there";
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = shell(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
      Welcome to Reduvia! 🎉
    </h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.5);font-size:14px;">${greeting} — your account is ready.</p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
      Reduvia helps you take control of your finances — track income and expenses,
      set category budgets, import bank statements, and get AI-powered insights
      that actually make sense.
    </p>

    <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Here's what you can do right now:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:4px;">
      ${featureItem("Add your first transaction in seconds")}
      ${featureItem("Set monthly budgets per spending category")}
      ${featureItem("See your income vs. expenses at a glance")}
      ${featureItem("Import a bank statement to auto-categorise transactions with AI")}
    </table>

    ${ctaButton("Go to your dashboard", dashboardUrl)}

    <p style="margin:32px 0 0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;">
      Questions? Reply to this email and we'll get back to you.
    </p>
  `);

  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Welcome to Reduvia! 🎉",
    html,
  });
}

// ── sendProWelcomeEmail ───────────────────────────────────────────────────────

export async function sendProWelcomeEmail(
  email: string,
  name: string | null
): Promise<void> {
  const resend      = getResendClient();
  if (!resend) return;

  const greeting    = name ? `Congrats, ${name}` : "Congrats";
  const dashboardUrl = `${APP_URL}/dashboard`;

  const html = shell(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
      You're a Pro member now! 🚀
    </h1>
    <p style="margin:0 0 24px;color:rgba(255,255,255,0.5);font-size:14px;">${greeting} — your Pro plan is active.</p>

    <p style="margin:0 0 20px;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
      Thank you for upgrading. You now have full access to every Pro feature on Reduvia.
      Here's everything that's unlocked for you:
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:4px;">
      ${featureItem("AI spending anomaly detection — get alerted when a category spikes")}
      ${featureItem("AI budget predictions — see which budgets you're on track to exceed")}
      ${featureItem("AI financial health score — understand your finances at a glance")}
      ${featureItem("Natural language transaction search — ask questions in plain English")}
      ${featureItem("Bank statement import with AI categorisation")}
      ${featureItem("AI bank statement analysis — recurring charges, spending patterns, and more")}
      ${featureItem("Automatic recurring transaction detection")}
      ${featureItem("Monthly spending summary emails")}
    </table>

    ${ctaButton("Explore your Pro dashboard", dashboardUrl)}

    <p style="margin:32px 0 0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;">
      You can manage your subscription at any time from the
      <a href="${APP_URL}/billing" style="color:rgba(139,92,246,0.8);text-decoration:none;">billing page</a>.
    </p>
  `);

  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Welcome to Reduvia Pro! 🚀",
    html,
  });
}

// ── sendMonthlySpendingSummary ────────────────────────────────────────────────

export async function sendMonthlySpendingSummary(
  email: string,
  name: string | null,
  totalIncome: number,
  totalExpenses: number,
  topCategory: string | null
): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;

  const greeting     = name ? `Hi ${name}` : "Hi there";
  const dashboardUrl = `${APP_URL}/dashboard`;
  const net          = totalIncome - totalExpenses;
  const netPositive  = net >= 0;

  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const html = shell(`
    <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
      Your ${monthName} summary
    </h1>
    <p style="margin:0 0 32px;color:rgba(255,255,255,0.5);font-size:14px;">${greeting} — here's how your month looked.</p>

    <!-- Stats row -->
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px 0;">
      <tr>
        ${statBox("Income",   fmt(totalIncome),   "#34d399")}
        ${statBox("Expenses", fmt(totalExpenses),  "#f87171")}
        ${statBox("Net",      (netPositive ? "+" : "") + fmt(net), netPositive ? "#34d399" : "#f87171")}
      </tr>
    </table>

    ${topCategory ? `
    <p style="margin:28px 0 0;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
      Your biggest spending category this month was
      <span style="color:#a78bfa;font-weight:600;text-transform:capitalize;">${topCategory}</span>.
      ${netPositive
        ? "Great work keeping your spending below your income!"
        : "Consider reviewing your budget to get back on track."}
    </p>` : `
    <p style="margin:28px 0 0;color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
      ${netPositive
        ? "Great work — you kept your spending below your income this month!"
        : "You spent more than you earned this month. Consider reviewing your budget."}
    </p>`}

    ${ctaButton("View full dashboard", dashboardUrl)}

    <p style="margin:32px 0 0;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;">
      This summary is sent automatically each month.
      Log in to see a full breakdown of every transaction.
    </p>
  `);

  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `Your ${monthName} spending summary — Reduvia`,
    html,
  });
}
