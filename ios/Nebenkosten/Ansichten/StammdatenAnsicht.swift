import SwiftUI

struct StammdatenAnsicht: View {
    @EnvironmentObject private var speicher: Datenspeicher

    var body: some View {
        Form {
            Section {
                TextField("Name oder Firma", text: $speicher.daten.vermieter.name)
                TextField("Straße und Hausnummer", text: $speicher.daten.vermieter.strasse)
                TextField("PLZ", text: $speicher.daten.vermieter.plz)
                TextField("Ort", text: $speicher.daten.vermieter.ort)
                TextField("Telefon", text: $speicher.daten.vermieter.telefon)
                    .keyboardType(.phonePad)
                TextField("E-Mail", text: $speicher.daten.vermieter.email)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                TextField("IBAN", text: $speicher.daten.vermieter.iban)
                TextField("Bank", text: $speicher.daten.vermieter.bank)
            } header: {
                Text("Vermieter / Abrechnender")
            } footer: {
                Text("Der Mieter muss erkennen können, wer abrechnet und wo er Belegeinsicht nehmen kann (§ 259 BGB).")
            }

            Section("Abrechnungsobjekt") {
                TextField("Bezeichnung", text: $speicher.daten.objekt.bezeichnung)
                TextField("Straße und Hausnummer", text: $speicher.daten.objekt.strasse)
                TextField("PLZ", text: $speicher.daten.objekt.plz)
                TextField("Ort", text: $speicher.daten.objekt.ort)
            }

            Section {
                ZahlFeld(titel: "Gesamtwohnfläche",
                         wert: $speicher.daten.objekt.wohnflaecheGesamt,
                         einheit: "m²")
                LabeledContent("Summe der Einheiten") {
                    HStack(spacing: 10) {
                        Text("\(Geld.zahl(speicher.daten.summeWohnflaechen)) m²")
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                        Button("Übernehmen") { speicher.uebernehmeWohnflaeche() }
                            .buttonStyle(.borderless)
                    }
                }
            } header: {
                Text("Wohnfläche")
            } footer: {
                Text("Die Wohnfläche ist der gesetzliche Auffangschlüssel (§ 556a Abs. 1 Satz 1 BGB). Weichen Summe und Gesamtfläche voneinander ab, wird zu viel oder zu wenig umgelegt.")
            }

            Section {
                Picker("Gebäudetyp", selection: $speicher.daten.objekt.gebaeudetyp) {
                    ForEach(Gebaeudetyp.allCases) { typ in
                        Text(typ.bezeichnung).tag(typ)
                    }
                }
                ZahlFeld(titel: "Personen bei Leerstand",
                         wert: $speicher.daten.objekt.leerstandPersonen,
                         einheit: "Pers.",
                         nachkomma: 0,
                         hinweis: "Ansatz für den Personenschlüssel in Leerstandszeiten – die Kosten trägt der Vermieter.")
                Picker("Zählerdifferenz", selection: $speicher.daten.objekt.verbrauchsdifferenz) {
                    ForEach(Verbrauchsdifferenz.allCases) { modus in
                        Text(modus.bezeichnung).tag(modus)
                    }
                }
            } header: {
                Text("Weitere Einstellungen")
            } footer: {
                Text("Der Gebäudetyp bestimmt die CO₂-Kostenaufteilung. Die Zählerdifferenz regelt, wie Allgemein- und Schwundwasser behandelt werden – die Differenz zwischen Hauptzähler und Summe der Wohnungszähler.")
            }
        }
    }
}
