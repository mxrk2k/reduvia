import WidgetKit
import SwiftUI

// ── Constants ─────────────────────────────────────────────────────────────────

private let appGroupID   = "group.com.reduvia.mobile"
private let supabaseURL  = "https://xaarkbivfholdecznwkx.supabase.co"
private let supabaseAnon = "sb_publishable_ZNWBu_K6c7yLS4pIWy9pmQ_POzNtoDF"

// ── Data model ────────────────────────────────────────────────────────────────

struct FinanceSummary {
    var income:   Double = 0
    var expenses: Double = 0
    var net:      Double { income - expenses }
}

// ── Network fetch ─────────────────────────────────────────────────────────────

/// Fetch the current month's income and expense totals from the Supabase
/// REST API using the access token written to App Group UserDefaults by the
/// main app on each launch.
func fetchFinanceSummary() async -> FinanceSummary {
    let defaults = UserDefaults(suiteName: appGroupID)

    // Access token written by the main app; fall back to anon requests if absent
    let accessToken = defaults?.string(forKey: "supabase_access_token") ?? ""

    // YYYY-MM-01 — first day of the current month
    let cal      = Calendar.current
    let now      = Date()
    let comps    = cal.dateComponents([.year, .month], from: now)
    let year     = comps.year  ?? 2025
    let month    = comps.month ?? 1
    let monthStr = String(format: "%04d-%02d-01", year, month)

    guard let url = URL(string:
        "\(supabaseURL)/rest/v1/transactions" +
        "?select=type,amount" +
        "&created_at=gte.\(monthStr)"
    ) else { return FinanceSummary() }

    var req = URLRequest(url: url)
    req.setValue("Bearer \(accessToken.isEmpty ? supabaseAnon : accessToken)",
                 forHTTPHeaderField: "Authorization")
    req.setValue(supabaseAnon, forHTTPHeaderField: "apikey")
    req.setValue("application/json", forHTTPHeaderField: "Accept")

    do {
        let (data, _) = try await URLSession.shared.data(for: req)
        struct Row: Decodable { let type: String; let amount: Double }
        let rows = try JSONDecoder().decode([Row].self, from: data)

        var summary = FinanceSummary()
        for row in rows {
            if row.type == "income"  { summary.income   += row.amount }
            if row.type == "expense" { summary.expenses += row.amount }
        }
        return summary
    } catch {
        return FinanceSummary()
    }
}

// ── Timeline entry ────────────────────────────────────────────────────────────

struct FinanceEntry: TimelineEntry {
    let date:    Date
    let summary: FinanceSummary
}

// ── Provider ──────────────────────────────────────────────────────────────────

struct FinanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> FinanceEntry {
        FinanceEntry(date: Date(), summary: FinanceSummary(income: 4200, expenses: 2800))
    }

    func getSnapshot(in context: Context, completion: @escaping (FinanceEntry) -> Void) {
        Task {
            let summary = await fetchFinanceSummary()
            completion(FinanceEntry(date: Date(), summary: summary))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FinanceEntry>) -> Void) {
        Task {
            let summary = await fetchFinanceSummary()
            let entry   = FinanceEntry(date: Date(), summary: summary)

            // Refresh every hour
            let nextRefresh = Calendar.current.date(byAdding: .hour, value: 1, to: Date())!
            let timeline    = Timeline(entries: [entry], policy: .after(nextRefresh))
            completion(timeline)
        }
    }
}

// ── Formatters ────────────────────────────────────────────────────────────────

private func fmt(_ n: Double) -> String {
    let abs = Swift.abs(n)
    if abs >= 1_000 {
        return String(format: "$%.1fk", abs / 1_000)
    }
    return String(format: "$%.0f", abs)
}

// ── Small widget view (2×2) ───────────────────────────────────────────────────

struct SmallWidgetView: View {
    let summary: FinanceSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Reduvia")
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)

            Spacer()

            VStack(alignment: .leading, spacing: 4) {
                Label(fmt(summary.income), systemImage: "arrow.down")
                    .font(.callout.monospacedDigit())
                    .foregroundColor(.green)
                Label(fmt(summary.expenses), systemImage: "arrow.up")
                    .font(.callout.monospacedDigit())
                    .foregroundColor(.red)
            }

            Divider()

            HStack {
                Text("Net")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Spacer()
                Text(fmt(summary.net))
                    .font(.callout.bold().monospacedDigit())
                    .foregroundColor(summary.net >= 0 ? .green : .red)
            }
        }
        .padding(12)
    }
}

// ── Medium widget view (4×2) ──────────────────────────────────────────────────

struct MediumWidgetView: View {
    let summary: FinanceSummary

    private func statCell(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Reduvia")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
                Spacer()
                Text("This month")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            HStack(spacing: 0) {
                statCell(label: "Income",   value: fmt(summary.income),   color: .green)
                Divider().frame(height: 36)
                    .padding(.horizontal, 12)
                statCell(label: "Expenses", value: fmt(summary.expenses), color: .red)
                Divider().frame(height: 36)
                    .padding(.horizontal, 12)
                statCell(
                    label: "Net",
                    value: (summary.net >= 0 ? "+" : "") + fmt(summary.net),
                    color: summary.net >= 0 ? .green : .red
                )
            }
        }
        .padding(14)
    }
}

// ── Widget entry view (dispatches by family) ──────────────────────────────────

struct FinanceWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: FinanceEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(summary: entry.summary)
        case .systemMedium:
            MediumWidgetView(summary: entry.summary)
        default:
            MediumWidgetView(summary: entry.summary)
        }
    }
}

// ── Widget definition ─────────────────────────────────────────────────────────

struct FinanceWidget: Widget {
    let kind: String = "FinanceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FinanceProvider()) { entry in
            FinanceWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Reduvia Finance")
        .description("See your monthly income, expenses, and net balance at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// ── Preview ───────────────────────────────────────────────────────────────────

#Preview(as: .systemMedium) {
    FinanceWidget()
} timeline: {
    FinanceEntry(date: .now, summary: FinanceSummary(income: 4200, expenses: 2850))
}
