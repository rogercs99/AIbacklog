import XCTest
@testable import PhotoCleaner

final class PerceptualHashTests: XCTestCase {
    func testHammingDistance() {
        XCTAssertEqual(PerceptualHash.hammingDistance("0000000000000000", "0000000000000000"), 0)
        XCTAssertEqual(PerceptualHash.hammingDistance("0000000000000000", "0000000000000001"), 1)
        XCTAssertNil(PerceptualHash.hammingDistance("not-a-hash", "0"))
    }
}
