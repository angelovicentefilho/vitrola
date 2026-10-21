// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Vitrola",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "Vitrola",
            path: "Sources/Vitrola"
        )
    ]
)
