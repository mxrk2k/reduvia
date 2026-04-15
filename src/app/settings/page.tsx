import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportDataButton } from "@/components/export-data-button";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Your Data */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold">Your Data</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a copy of all data associated with your account.
        </p>
        <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium">Export your data</p>
              <p className="text-xs text-muted-foreground">
                JSON includes all tables. CSV contains your transactions only.
              </p>
            </div>
            <ExportDataButton />
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mt-10">
        <h2 className="mb-1 text-base font-semibold text-destructive">
          Danger Zone
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your account and all associated data. This cannot
          be undone.
        </p>
        <div className="rounded-lg border border-destructive/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Removes your account, transactions, budgets, and all other data.
              </p>
            </div>
            <DeleteAccountButton />
          </div>
        </div>
      </section>
    </main>
  );
}
