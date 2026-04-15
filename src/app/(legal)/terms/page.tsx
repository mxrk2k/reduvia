import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Reduvia",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: April 1, 2026
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
          {/* 1 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              1. Acceptance of Terms
            </h2>
            <p className="text-muted-foreground">
              By accessing or using Reduvia (&ldquo;the Service&rdquo;), you
              agree to be bound by these Terms of Service. If you do not agree
              with any part of these terms, you may not use the Service. These
              terms apply to all visitors, users, and anyone who accesses the
              Service.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              2. Description of Service
            </h2>
            <p className="text-muted-foreground">
              Reduvia is a personal finance tracking application that helps
              individuals manage their budgets, record transactions, and gain
              insight into their spending habits. Features include manual
              transaction entry, budget creation and monitoring, spending
              charts, and AI-powered parsing of uploaded bank statements for
              Pro subscribers.
            </p>
            <p className="mt-3 text-muted-foreground">
              The Service is intended for personal, non-commercial use. Reduvia
              does not provide financial advice. Any information displayed
              within the Service is for informational purposes only.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              3. User Accounts and Responsibilities
            </h2>
            <p className="text-muted-foreground">
              You must create an account to access most features of the
              Service. You are responsible for:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                Maintaining the confidentiality of your account credentials.
              </li>
              <li>
                All activity that occurs under your account.
              </li>
              <li>
                Ensuring that all information you provide is accurate and
                up-to-date.
              </li>
              <li>
                Notifying us immediately of any unauthorised access to your
                account.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              You must be at least 18 years old to use the Service. We reserve
              the right to suspend or terminate accounts that violate these
              terms.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              4. Subscription and Billing
            </h2>
            <p className="text-muted-foreground">
              Reduvia offers a free tier and a paid Pro subscription.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  Monthly fee:
                </span>{" "}
                The Pro plan is billed monthly at the rate displayed on the
                pricing page at the time of purchase.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Automatic renewal:
                </span>{" "}
                Subscriptions renew automatically each month until cancelled.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Cancellation:
                </span>{" "}
                You may cancel your subscription at any time through your
                billing settings. Cancellation takes effect at the end of the
                current billing period; you retain Pro access until that date.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  No refunds:
                </span>{" "}
                All charges are non-refundable. We do not issue partial
                refunds for unused portions of a billing period.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              Payments are processed securely by Stripe. Reduvia does not
              store your payment card details.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              5. Prohibited Uses
            </h2>
            <p className="text-muted-foreground">
              You agree not to use the Service to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                Violate any applicable law or regulation.
              </li>
              <li>
                Upload or transmit malicious code, viruses, or any other
                harmful material.
              </li>
              <li>
                Attempt to gain unauthorised access to any part of the Service
                or its related systems.
              </li>
              <li>
                Scrape, crawl, or otherwise extract data from the Service by
                automated means without our written consent.
              </li>
              <li>
                Resell, sublicense, or commercially exploit the Service.
              </li>
              <li>
                Impersonate any person or entity or misrepresent your
                affiliation with any person or entity.
              </li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              6. Disclaimers and Limitation of Liability
            </h2>
            <p className="text-muted-foreground">
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as
              available&rdquo; without warranties of any kind, either express
              or implied. Reduvia does not warrant that the Service will be
              uninterrupted, error-free, or completely secure.
            </p>
            <p className="mt-3 text-muted-foreground">
              To the fullest extent permitted by law, Reduvia and its operators
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of or
              inability to use the Service, even if we have been advised of the
              possibility of such damages. Our total liability to you for any
              claim arising out of these terms or the Service shall not exceed
              the amount you paid us in the three months preceding the claim.
            </p>
            <p className="mt-3 text-muted-foreground">
              Reduvia is not a financial advisor. Nothing in the Service
              constitutes financial, investment, tax, or legal advice.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              7. Changes to These Terms
            </h2>
            <p className="text-muted-foreground">
              We may update these Terms of Service from time to time. When we
              do, we will update the effective date above. Continued use of the
              Service after changes are posted constitutes your acceptance of
              the revised terms.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              8. Contact Information
            </h2>
            <p className="text-muted-foreground">
              If you have questions about these Terms of Service, please
              contact us at{" "}
              <a
                href="mailto:markmelds@gmail.com"
                className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
              >
                markmelds@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t pt-8 text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Reduvia. All rights reserved.
          </p>
          <p className="mt-1">
            <Link
              href="/privacy"
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
