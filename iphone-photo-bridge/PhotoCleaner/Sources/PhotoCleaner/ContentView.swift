import SwiftUI
import Photos
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @StateObject private var library = PhotoLibraryIndex()
    @StateObject private var analyzer = PhotoAnalyzer()

    var body: some View {
        NavigationStack {
            Form {
                Section("Privacidad") {
                    Label("Las fotos se analizan en este iPhone", systemImage: "iphone.gen3")
                    Text("No se suben originales. Solo se podrán enviar metadatos o fingerprints pequeños cuando habilitemos el puente VPS.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Biblioteca") {
                    row("Permiso", value: authorizationLabel)
                    row("Elementos", value: "\(library.totalAssets)")
                    row("Indexados", value: "\(library.indexedAssets)")
                    row("Capturas", value: "\(library.screenshotCount)")
                    if library.isIndexing {
                        ProgressView(value: Double(library.indexedAssets), total: Double(max(library.totalAssets, 1)))
                    }
                    Button("Autorizar e indexar") { library.requestAccessAndIndex() }
                        .disabled(library.isIndexing)
                    if library.isIndexing {
                        Button("Cancelar indexado", role: .cancel) { library.cancel() }
                    }
                }

                Section("Análisis local de prueba") {
                    row("Procesadas", value: "\(analyzer.summary.processed)/\(analyzer.summary.requested)")
                    row("Feature prints", value: "\(analyzer.summary.featurePrints)")
                    row("Hashes perceptuales", value: "\(analyzer.summary.perceptualHashes)")
                    row("Solo en iCloud / no disponibles", value: "\(analyzer.summary.unavailableLocally)")
                    if analyzer.isAnalyzing { ProgressView(value: analyzer.progress) }
                    Button("Analizar 250 recientes") {
                        analyzer.analyzeFirst(limit: 250, modelContext: modelContext)
                    }
                    .disabled(analyzer.isAnalyzing || !canReadLibrary)
                    if analyzer.isAnalyzing {
                        Button("Cancelar análisis", role: .cancel) { analyzer.cancel() }
                    }
                }

                if let error = library.lastError ?? analyzer.lastError {
                    Section("Error") {
                        Text(error).foregroundStyle(.red)
                    }
                }

                Section("Borrado") {
                    Text("Desactivado en este ciclo. Ningún análisis borra fotos. La futura revisión exigirá selección explícita y la confirmación de Fotos, enviando los elementos a Eliminado recientemente.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Photo Cleaner")
            .task { library.attach(modelContext: modelContext) }
        }
    }

    private var canReadLibrary: Bool {
        library.authorizationStatus == .authorized || library.authorizationStatus == .limited
    }

    private var authorizationLabel: String {
        switch library.authorizationStatus {
        case .authorized: return "Completo"
        case .limited: return "Limitado"
        case .denied: return "Denegado"
        case .restricted: return "Restringido"
        case .notDetermined: return "Sin solicitar"
        @unknown default: return "Desconocido"
        }
    }

    @ViewBuilder
    private func row(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value).foregroundStyle(.secondary)
        }
    }
}
