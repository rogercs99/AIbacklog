import Foundation
import Photos
import Vision
import SwiftData

struct AnalysisSummary: Sendable {
    var requested = 0
    var processed = 0
    var unavailableLocally = 0
    var featurePrints = 0
    var perceptualHashes = 0
}

@MainActor
final class PhotoAnalyzer: ObservableObject {
    @Published private(set) var isAnalyzing = false
    @Published private(set) var progress: Double = 0
    @Published private(set) var summary = AnalysisSummary()
    @Published private(set) var lastError: String?

    private let thumbnails = ThumbnailProvider()
    private var task: Task<Void, Never>?

    func analyzeFirst(limit: Int, modelContext: ModelContext) {
        task?.cancel()
        task = Task { [weak self] in
            guard let self else { return }
            isAnalyzing = true
            progress = 0
            summary = AnalysisSummary()
            lastError = nil
            defer { isAnalyzing = false }

            let options = PHFetchOptions()
            options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            let fetch = PHAsset.fetchAssets(with: .image, options: options)
            let count = min(limit, fetch.count)
            summary.requested = count

            do {
                for index in 0..<count {
                    try Task.checkCancellation()
                    let asset = fetch.object(at: index)
                    guard let cgImage = await thumbnails.cgImage(for: asset, allowNetwork: false) else {
                        summary.unavailableLocally += 1
                        summary.processed += 1
                        progress = Double(index + 1) / Double(max(count, 1))
                        continue
                    }

                    let featureRequest = VNGenerateImageFeaturePrintRequest()
                    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                    try handler.perform([featureRequest])
                    let observation = featureRequest.results?.first as? VNFeaturePrintObservation
                    if observation != nil { summary.featurePrints += 1 }
                    let pHash = PerceptualHash.dHashHex(cgImage: cgImage)
                    if pHash != nil { summary.perceptualHashes += 1 }

                    let id = asset.localIdentifier
                    var descriptor = FetchDescriptor<AssetRecord>(predicate: #Predicate { $0.localIdentifier == id })
                    descriptor.fetchLimit = 1
                    if let record = try modelContext.fetch(descriptor).first {
                        record.perceptualHash = pHash
                        record.featurePrintRevision = observation?.requestRevision
                    }

                    summary.processed += 1
                    progress = Double(index + 1) / Double(max(count, 1))
                    if (index + 1).isMultiple(of: 50) {
                        try modelContext.save()
                        await Task.yield()
                    }
                }
                try modelContext.save()
            } catch is CancellationError {
                lastError = nil
            } catch {
                lastError = error.localizedDescription
            }
        }
    }

    func cancel() {
        task?.cancel()
        task = nil
    }
}
