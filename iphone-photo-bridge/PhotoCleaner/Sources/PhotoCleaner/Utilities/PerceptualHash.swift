import Foundation
import CoreGraphics

struct PerceptualHash {
    static func dHashHex(cgImage: CGImage) -> String? {
        let width = 9
        let height = 8
        let bytesPerRow = width
        var pixels = [UInt8](repeating: 0, count: width * height)

        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceGray(),
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { return nil }

        context.interpolationQuality = .low
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        var hash: UInt64 = 0
        var bit: UInt64 = 0
        for y in 0..<height {
            for x in 0..<(width - 1) {
                if pixels[y * width + x] > pixels[y * width + x + 1] {
                    hash |= (1 << bit)
                }
                bit += 1
            }
        }
        return String(format: "%016llx", hash)
    }

    static func hammingDistance(_ lhs: String, _ rhs: String) -> Int? {
        guard let a = UInt64(lhs, radix: 16), let b = UInt64(rhs, radix: 16) else { return nil }
        return (a ^ b).nonzeroBitCount
    }
}
