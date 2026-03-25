import { CURRENCY, CURRENCY_LOCALE } from "./constants";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(CURRENCY_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
