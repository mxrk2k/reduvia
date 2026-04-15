# Reduvia

A personal finance tracker I built as part of my graduate software engineering coursework. The idea came from wanting something that actually helps you understand where your money goes — not just log transactions.

## What it does

- Add income and expenses manually, with categories and descriptions
- See your balance, spending breakdown, and monthly trends on a dashboard
- Set monthly budgets per category — the app warns you when you're spending faster than you should be
- Import a bank statement PDF (Chase, AMEX, or most major banks) and get AI-powered analysis of your spending
- Recurring transactions with due-soon reminders
- Search and filter your transaction history
- Export to CSV
- Mobile app (iOS and Android) built with React Native and Expo

## Live demo

https://reduvia.vercel.app

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL + Auth)
- TailwindCSS + shadcn/ui
- Recharts for data visualization
- Three.js for the login page background
- Anthropic API (Claude) for bank statement parsing
- React Native + Expo for the mobile app
- Deployed on Vercel

## Running locally

You'll need Node.js 18+ and a Supabase project.

1. Clone the repo
2. Install dependencies: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase and Anthropic keys
4. Run the dev server: `npm run dev`
5. Open http://localhost:3000

For the mobile app:
  cd mobile
  npx expo start

## Environment variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=

## Database

Run the migrations in `supabase/migrations/` in order (001 through 007) against your Supabase project using the SQL editor.

## Notes

This started as a simple transaction tracker and grew from there. The bank statement import feature ended up being the most interesting part to build — getting Claude to reliably parse PDFs from different banks took a few iterations, final pdf-parsing with Claude AI works well now.

Built by Mark D'Souza — MS Computer Science student at Cleveland State University.
