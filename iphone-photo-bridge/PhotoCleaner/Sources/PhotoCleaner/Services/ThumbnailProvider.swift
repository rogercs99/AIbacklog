import Foundation
import Photos
import UIKit

actor ThumbnailProvider {
    private let manager = PHCachingImageManager()

    func cgImage(for asset: PHAsset, size: CGSize = CGSize(width: 256, height: 256), allowNetwork: Bool = false) async -> CGImage? {
        await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.isNetworkAccessAllowed = allowNetwork
            options.deliveryMode = .highQualityFormat
            options.resizeMode = .fast
            options.isSynchronous = false

            var completed = false
            manager.requestImage(
                for: asset,
                targetSize: size,
                contentMode: .aspectFit,
                options: options
            ) { image, info in
                guard !completed else { return }
                let isDegraded = (info?[PHImageResultIsDegradedKey] as? Bool) ?? false
                let error = info?[PHImageErrorKey] as? Error
                let cancelled = (info?[PHImageCancelledKey] as? Bool) ?? false

                if error != nil || cancelled {
                    completed = true
                    continuation.resume(returning: nil)
                    return
                }
                guard !isDegraded else { return }
                completed = true
                continuation.resume(returning: image?.cgImage)
            }
        }
    }
}
