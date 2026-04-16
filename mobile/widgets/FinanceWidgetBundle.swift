import WidgetKit
import SwiftUI

/// Widget bundle — all widget types exported from this extension.
/// Add additional Widget conformances here as the app grows.
@main
struct FinanceWidgetBundle: WidgetBundle {
    var body: some Widget {
        FinanceWidget()
    }
}
