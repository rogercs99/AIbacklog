import Foundation
import Photos
import SwiftData

@MainActor
final class PhotoLibraryIndex: NSObject, ObservableObject, PHPhotoLibraryChangeObserver {
    @Published private(set) var authorizationStatus = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    @Published private(set) var totalAssets = 0
    @Published private(set) var indexedAssets = 0
    @Published private(set) var screenshotCount = 0
    @Published private(set) var isIndexing = false
    @Published private(set) var lastError: String?

    private var modelContext: ModelContext?
    private var changeObserverRegistered = false
    private var indexingTask: Task<Void, Never>?

    func attach(modelContext: ModelContext) {
        self.modelContext = modelContext
        guard !changeObserverRegistered else { return }
        PHPhotoLibrary.shared().register(self)
        changeObserverRegistered = true
    }

    func requestAccessAndIndex() {
        indexingTask?.cancel()
        indexingTask = Task { [weak self] in
            guard let self else { return }
            let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
            authorizationStatus = status
            guard status == .authorized || status == .limited else { return }
            await rebuildIncrementally()
        }
    }

    func rebuildIncrementally() async {
        guard let modelContext else {
            lastError = "Local metadata store is not attached."
            return
        }
        guard authorizationStatus == .authorized || authorizationStatus == .limited else { return }

        isIndexing = true
        lastError = nil
        defer { isIndexing = false }

        do {
            let descriptor = FetchDescriptor<AssetRecord>()
            let persisted = try modelContext.fetch(descriptor)
            var existingByID = Dictionary(uniqueKeysWithValues: persisted.map { ($0.localIdentifier, $0) })

            let fetch = PHAsset.fetchAssets(with: nil)
            totalAssets = fetch.count
            indexedAssets = 0
            screenshotCount = 0
            var liveIDs = Set<String>()
            liveIDs.reserveCapacity(fetch.count)

            let now = Date()
            for index in 0..<fetch.count {
                try Task.checkCancellation()
                let asset = fetch.object(at: index)
                let id = asset.localIdentifier
                liveIDs.insert(id)

                if let record = existingByID.removeValue(forKey: id) {
                    if record.modificationDate != asset.modificationDate ||
                        record.pixelWidth != asset.pixelWidth ||
                        record.pixelHeight != asset.pixelHeight ||
                        record.mediaSubtypesRaw != Int(asset.mediaSubtypes.rawValue) ||
                        record.isFavorite != asset.isFavorite ||
                        record.isHidden != asset.isHidden {
                        record.refresh(from: asset, indexedAt: now)
                    }
                    if record.isScreenshot { screenshotCount += 1 }
                } else {
                    let record = AssetRecord(asset: asset, indexedAt: now)
                    modelContext.insert(record)
                    if record.isScreenshot { screenshotCount += 1 }
                }

                indexedAssets = index + 1
                if (index + 1).isMultiple(of: 250) {
                    try modelContext.save()
                    await Task.yield()
                }
            }

            for stale in persisted where !liveIDs.contains(stale.localIdentifier) {
                modelContext.delete(stale)
            }
            try modelContext.save()
        } catch is CancellationError {
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func cancel() {
        indexingTask?.cancel()
        indexingTask = nil
    }

    nonisolated func photoLibraryDidChange(_ changeInstance: PHChange) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            authorizationStatus = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            guard authorizationStatus == .authorized || authorizationStatus == .limited else { return }
            await rebuildIncrementally()
        }
    }
}
