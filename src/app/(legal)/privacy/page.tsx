import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Reduvia",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: April 1, 2026
        </p>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Reduvia (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;)
          is committed to protecting your personal information. This Privacy
          Policy explains what data we collect, how we use and store it, who
          we share it with, and what rights you have over it.
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
          {/* 1 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              1. Data We Collect
            </h2>
            <p className="text-muted-foreground">
              We collect only what is necessary to provide the Service:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  Account information:
                </span>{" "}
                Your email address, used to create and authenticate your
                account. If you sign in with Google, we receive your email
                address and public profile name via OAuth.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Financial transactions:
                </span>{" "}
                Transaction records (amount, date, category, description) that
                you enter manually into the Service.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Bank statements (Pro only):
                </span>{" "}
                PDF bank statements you choose to upload. These are sent to an
                AI service for parsing and are not retained after processing
                (see Section 3).
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Usage data:
                </span>{" "}
                Basic technical information such as your IP address and browser
                type, collected automatically by our infrastructure to maintain
                security and reliability.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              We do not collect payment card details. Billing information is
              handled directly by Stripe (see Section 3).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              2. How We Store Your Data
            </h2>
            <p className="text-muted-foreground">
              Your account and financial data are stored securely in{" "}
              <span className="font-medium text-foreground">Supabase</span>, a
              managed database and authentication platform. Data is stored in
              the EU (Frankfurt) region and is encrypted at rest and in
              transit. Access is restricted to authenticated requests associated
              with your account.
            </p>
            <p className="mt-3 text-muted-foreground">
              We retain your data for as long as your account is active. You
              may request deletion of your data at any time (see Section 5).
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              3. Third Parties We Share Data With
            </h2>
            <p className="text-muted-foreground">
              We share your data with the following third-party services solely
              to operate the Service. We do not sell your data to third parties.
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <p className="font-medium">Supabase</p>
                <p className="mt-1 text-muted-foreground">
                  Provides database storage and user authentication. Your email
                  address, account credentials, and all financial data you
                  enter are stored on Supabase servers.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Privacy policy: supabase.com/privacy
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="font-medium">Anthropic</p>
                <p className="mt-1 text-muted-foreground">
                  Powers AI parsing of uploaded bank statements (Pro feature).
                  The text content of your PDF statements is sent to
                  Anthropic&apos;s API to extract transaction data. Anthropic
                  does not use your data to train its models under our API
                  agreement, and the content is not stored by us after
                  processing completes.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Privacy policy: anthropic.com/privacy
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="font-medium">Stripe</p>
                <p className="mt-1 text-muted-foreground">
                  Processes subscription payments for the Pro plan. When you
                  subscribe, you interact directly with Stripe&apos;s secure
                  checkout. We receive confirmation of your subscription status
                  but never see or store your full payment card details.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Privacy policy: stripe.com/privacy
                </p>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              4. Cookies and Tracking
            </h2>
            <p className="text-muted-foreground">
              We use session cookies strictly to keep you signed in. We do not
              use advertising trackers, analytics pixels, or third-party
              behavioural tracking cookies.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              5. Your Rights
            </h2>
            <p className="text-muted-foreground">
              You have the following rights over your personal data:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  Data export:
                </span>{" "}
                You may request a copy of all data we hold about you, delivered
                in a machine-readable format (CSV or JSON).
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Account deletion:
                </span>{" "}
                You may request deletion of your account and all associated
                data at any time. Upon deletion, your data will be permanently
                removed from our systems within 30 days.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  Correction:
                </span>{" "}
                You may update or correct your account information at any time
                through the settings page.
              </li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              To exercise any of these rights, contact us at the address below.
              We will respond within 30 days.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              6. Changes to This Policy
            </h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. When we do,
              we will update the effective date at the top of this page. We
              encourage you to review this page periodically. Continued use of
              the Service after changes are posted constitutes your acceptance
              of the revised policy.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-base font-semibold">
              7. Contact Information
            </h2>
            <p className="text-muted-foreground">
              If you have questions or requests regarding this Privacy Policy
              or your personal data, please contact us at{" "}
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
              href="/terms"
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Terms of Service
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
