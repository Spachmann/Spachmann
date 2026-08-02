import SwiftUI

@main
struct NebenkostenApp: App {
    @StateObject private var speicher = Datenspeicher()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootAnsicht()
                .environmentObject(speicher)
                .environment(\.locale, Locale(identifier: "de_DE"))
        }
        .onChange(of: phase) { neu in
            // Beim Wechsel in den Hintergrund den Datenbestand festschreiben.
            if neu != .active { speicher.sichereSofort() }
        }
    }
}
