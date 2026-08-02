// swift-tools-version: 5.9
import PackageDescription

/// Der Rechenkern ist als eigenständiges Swift-Paket beschrieben und hängt
/// ausschließlich von Foundation ab. Dadurch lässt er sich ohne Xcode und ohne
/// Simulator prüfen:
///
///     cd ios && swift test
///
/// Dieselben Quellen liegen zugleich im App-Ziel des Xcode-Projekts, sodass es
/// nur eine Fassung des Rechenkerns gibt.
let package = Package(
    name: "NebenkostenKern",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "NebenkostenKern", targets: ["NebenkostenKern"]),
    ],
    targets: [
        .target(name: "NebenkostenKern", path: "Nebenkosten/Kern"),
        .testTarget(name: "NebenkostenKernTests", dependencies: ["NebenkostenKern"], path: "Tests/KernTests"),
    ]
)
