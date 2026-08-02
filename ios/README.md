# Nebenkosten – native iPad-App (SwiftUI)

Native iOS-/iPadOS-Fassung der Nebenkostenabrechnung. Sie enthält denselben
Rechenkern wie die Web-App im Wurzelverzeichnis, hier in Swift, und erzeugt die
Abrechnung als echte PDF-Datei im A4-Format.

## Öffnen und starten

**Schritt für Schritt vom Klonen bis zur App auf dem iPad:
[ANLEITUNG.md](ANLEITUNG.md)**

Kurzfassung:

```bash
cd ios
swift test                    # Rechenkern prüfen – zuerst ausführen
open Nebenkosten.xcodeproj
```

In Xcode unter *Signing & Capabilities* dein Entwicklerteam auswählen und auf
einem iPad oder im Simulator starten (⌘R). Die Bundle-ID lautet
`de.spachmann.nebenkosten`, das Mindestziel ist iOS 16.

## Rechenkern prüfen – ohne Xcode

Der Rechenkern hängt nur von Foundation ab und ist zusätzlich als Swift-Paket
beschrieben. Damit lässt er sich auf jedem Mac (und unter Linux) unmittelbar
testen:

```bash
cd ios
swift test
```

Die Tests vergleichen das Ergebnis Zahl für Zahl mit den Referenzwerten der
Web-Fassung. Weicht die Portierung ab, schlagen sie fehl.

> **Wichtig:** Dieser Swift-Code wurde in einer Linux-Umgebung ohne Swift-
> Toolchain geschrieben und konnte dort nicht kompiliert werden. Führe daher als
> Erstes `swift test` aus – das prüft den gesamten Rechenkern einschließlich der
> Dokumenterzeugung, bevor du die Oberfläche startest.

## Aufbau

```
ios/
├── Package.swift                     Swift-Paket für den Rechenkern (swift test)
├── Nebenkosten.xcodeproj/            generiert, siehe tools/
├── Nebenkosten/
│   ├── App/
│   │   ├── NebenkostenApp.swift      Einstiegspunkt
│   │   └── Assets.xcassets           App-Symbol und Akzentfarbe
│   ├── Kern/                         reine Rechenlogik, ohne UIKit/SwiftUI
│   │   ├── Geld.swift                Cent-Arithmetik und deutsche Formatierung
│   │   ├── Datum.swift               tagegenaue Zeitraumrechnung
│   │   ├── Katalog.swift             § 2 BetrKV und nicht umlagefähige Arten
│   │   ├── CO2.swift                 Stufenmodell des CO2KostAufG
│   │   ├── Heizkosten.swift          HeizkostenV
│   │   ├── Modell.swift              Datenmodell (Codable)
│   │   ├── Abrechnung.swift          Nutzungszeiträume, Verteilung, Ergebnis
│   │   ├── Pruefung.swift            Rechts- und Plausibilitätsprüfung
│   │   ├── Demodaten.swift           Beispieldatensatz
│   │   └── DokumentHTML.swift        Abrechnungsdokument als HTML
│   ├── Dienste/
│   │   ├── Datenspeicher.swift       Persistenz, Sicherung, Neuberechnung
│   │   └── PDFDienst.swift           HTML → A4-PDF, Drucken, Teilen
│   └── Ansichten/                    SwiftUI-Oberfläche
├── Tests/KernTests/                  XCTest gegen die Referenzwerte
└── tools/
    ├── xcodeproj-erzeugen.mjs        erzeugt die Projektdatei aus dem Dateibaum
    └── xcodeproj-pruefen.mjs         prüft die Projektdatei strukturell
```

### Warum ein Generator für das Xcode-Projekt

`project.pbxproj` wird aus dem Dateibaum erzeugt, damit neue Dateien nicht von
Hand eingetragen werden müssen und die Objektkennungen reproduzierbar bleiben:

```bash
node ios/tools/xcodeproj-erzeugen.mjs   # nach dem Anlegen neuer Swift-Dateien
node ios/tools/xcodeproj-pruefen.mjs    # Syntax, Verweise, Bauphasen, Dateibaum
```

Wer lieber in Xcode arbeitet, kann Dateien auch dort hinzufügen – dann sollte
der Generator nicht mehr ausgeführt werden, weil er die Projektdatei neu
schreibt.

## Was die App kann

Fachlich deckungsgleich mit der Web-Fassung – siehe die ausführliche
Beschreibung in `../README.md`:

* Trennung umlagefähiger Kosten (§ 2 BetrKV) von nicht umlagefähigen
  (§ 1 Abs. 2 BetrKV), inklusive begründeter Teilabzüge
* tagegenaue Abrechnung bei Mieterwechsel, Leerstandskosten beim Vermieter
* HeizkostenV mit 50–70 % Verbrauchsanteil, § 9 Abs. 2 bei verbundenen Anlagen
  und 15-%-Kürzung nach § 12 Abs. 1
* CO₂-Kostenaufteilung nach dem Zehn-Stufen-Modell des CO2KostAufG
* Bescheinigung nach § 35a EStG
* automatische Rechtsprüfung mit Fehlern, Warnungen und Hinweisen

Zusätzlich zur Web-Fassung:

* **Echte PDF-Erzeugung** über `UIPrintPageRenderer` mit A4-Paginierung, statt
  über den Druckdialog des Browsers
* **Teilen und Drucken** über das Systemmenü und AirPrint
* Ablage im Dateisystem der App statt im Browserspeicher

### Datenaustausch mit der Web-App

Beide Fassungen benutzen dasselbe JSON-Format. Eine Sicherung aus der Web-App
lässt sich über *Daten & Sicherung → Sicherung laden* einlesen und umgekehrt.
Fehlende Felder werden beim Lesen auf ihre Standardwerte gesetzt, ältere
Sicherungen sind also weiterhin verwendbar.

## Rechtlicher Hinweis

Die App unterstützt bei der Erstellung einer Betriebskostenabrechnung nach
§§ 556, 556a BGB, der Betriebskostenverordnung, der Heizkostenverordnung und dem
Kohlendioxidkostenaufteilungsgesetz. Ob eine Kostenart im konkreten Fall
umgelegt werden darf, richtet sich stets zusätzlich nach dem Mietvertrag. Die
automatische Prüfung ersetzt keine rechtliche Beratung.
