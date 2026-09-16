import Foundation
import SwiftData
import Photos

@Model
final class AssetRecord {
    @Attribute(.unique) var localIdentifier: String
    var creationDate: Date?
    var modificationDate: Date?
    var pixelWidth: Int
    var pixelHeight: Int
    var mediaTypeRaw: Int
    var mediaSubtypesRaw: Int
    var duration: Double
    var isFavorite: Bool
    var isHidden: Bool
    var sourceTypeRaw: Int
    var indexedAt: Date
    var perceptualHash: String?
    var blurScore: Double?
    var textScore: Double?
    var featurePrintRevision: Int?

    init(asset: PHAsset, indexedAt: Date = .now) {
        localIdentifier = asset.localIdentifier
        creationDate = asset.creationDate
        modificationDate = asset.modificationDate
        pixelWidth = asset.pixelWidth
        pixelHeight = asset.pixelHeight
        mediaTypeRaw = asset.mediaType.rawValue
        mediaSubtypesRaw = Int(asset.mediaSubtypes.rawValue)
        duration = asset.duration
        isFavorite = asset.isFavorite
        isHidden = asset.isHidden
        sourceTypeRaw = Int(asset.sourceType.rawValue)
        self.indexedAt = indexedAt
    }

    var isScreenshot: Bool {
        (mediaSubtypesRaw & Int(PHAssetMediaSubtype.photoScreenshot.rawValue)) != 0
    }

    func refresh(from asset: PHAsset, indexedAt: Date = .now) {
        creationDate = asset.creationDate
        modificationDate = asset.modificationDate
        pixelWidth = asset.pixelWidth
        pixelHeight = asset.pixelHeight
        mediaTypeRaw = asset.mediaType.rawValue
        mediaSubtypesRaw = Int(asset.mediaSubtypes.rawValue)
        duration = asset.duration
        isFavorite = asset.isFavorite
        isHidden = asset.isHidden
        sourceTypeRaw = Int(asset.sourceType.rawValue)
        self.indexedAt = indexedAt
    }
}
