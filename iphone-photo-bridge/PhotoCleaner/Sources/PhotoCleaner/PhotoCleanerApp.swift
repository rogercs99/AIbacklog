import SwiftUI
import SwiftData

@main
struct PhotoCleanerApp: App {
    private let container: ModelContainer

    init() {
        do {
            container = try ModelContainer(for: AssetRecord.self)
        } catch {
            fatalError("Unable to create local metadata store: \(error.localizedDescription)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(container)
    }
}
