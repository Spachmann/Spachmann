# Nur ein iPad? So geht es trotzdem

Kurze Antwort vorweg: **Ja, vollständig.** Alles, was die App kann – erfassen,
rechnen, prüfen, PDF erzeugen – geht allein mit dem iPad.

Du brauchst **keinen Mac und kein Terminal**. Die Einrichtung
läuft komplett im Browser auf dem iPad und dauert etwa fünf Minuten – danach
liegt die App als Symbol auf deinem Home-Bildschirm und funktioniert auch
offline.

---

## Schritt 1 – GitHub Pages einschalten

Der Code liegt bereits auf GitHub. GitHub kann ihn kostenlos als Website
ausliefern; das schaltest du einmal in den Einstellungen ein.

1. In **Safari** auf dem iPad
   <https://github.com/Spachmann/Spachmann/settings/pages> öffnen und anmelden.

   > Zeigt Safari die Seite zu klein oder abgeschnitten: auf **AA** in der
   > Adresszeile tippen → **Desktop-Website anfordern**.

2. Unter **Build and deployment → Source** den Eintrag
   **Deploy from a branch** wählen.

3. Darunter bei **Branch**:
   * links den Zweig **`claude/nebenkosten-abrechnung-app-pl34dv`** wählen
   * rechts **`/ (root)`** stehen lassen

4. **Save** antippen.

5. Ein bis drei Minuten warten und die Seite neu laden. Oben erscheint dann:
   *„Your site is live at https://spachmann.github.io/"*

Diese Adresse ist ab jetzt deine App.

### Was du dabei wissen solltest

* **Deine GitHub-Profilseite bleibt unberührt.** Das ist eine andere Funktion –
  die README-Datei auf deinem Profil wird weiterhin genau so angezeigt wie
  bisher.
* Belegt wird die Adresse `https://spachmann.github.io/`. Falls du dort schon
  eine eigene Website hattest, würde diese ersetzt. Sag mir Bescheid, dann
  richten wir stattdessen ein eigenes Repository ein – die App liegt dann unter
  `https://spachmann.github.io/nebenkosten/`.
* **Ist dein Repository privat**, verlangt GitHub für Pages ein
  kostenpflichtiges Konto. Dann entweder das Repository auf öffentlich stellen
  (prüfe vorher, was sonst noch darin liegt) oder mir Bescheid geben – es gibt
  Alternativen.
* Der Branch `claude/nebenkosten-abrechnung-app-pl34dv` muss bestehen bleiben.
  Wird er gelöscht, ist die Seite weg.
* Die App-Seite ist über die Adresse öffentlich erreichbar. **Deine erfassten
  Daten sind es nicht** – die liegen ausschließlich auf deinem iPad und werden
  nie übertragen. Die App hat kein Backend.

---

## Schritt 2 – Auf den Home-Bildschirm legen

1. Die Adresse in **Safari** öffnen (nicht Chrome – dort fehlt die Funktion)
2. Auf **Teilen** tippen (Quadrat mit Pfeil nach oben)
3. **Zum Home-Bildschirm** wählen
4. Namen bestätigen, zum Beispiel „Nebenkosten“

Ab jetzt startest du die App über ihr eigenes Symbol: Vollbild, ohne
Adresszeile, und sie funktioniert auch ohne Internetverbindung.

---

## Schritt 3 – Ausprobieren

Links **Daten & Sicherung → Beispieldaten laden** antippen. Danach zeigen alle
Bereiche ein vollständiges Portfolio: zwei privat gehaltene Immobilien und eine
GbR mit zwei weiteren Objekten, mit Mieterwechsel, Heizkosten und
CO₂-Aufteilung – gut, um sich vor der eigenen Abrechnung umzusehen. Oben in der
Seitenleiste kannst du zwischen den Objekten wechseln.

Wenn du dann startest: **Daten & Sicherung → Alle Daten löschen** und mit den
eigenen Vermietern und Objekten beginnen.

Reihenfolge für die eigene Abrechnung:

1. **Vermieter** – dich selbst anlegen; für eine GbR einen zweiten Eintrag mit
   Rechtsform *GbR* und dem Feld *Vertreten durch*
2. **Objekte** – jede Immobilie anlegen und dem richtigen Vermieter zuordnen
3. **Wohneinheiten** – jede Einheit mit Wohnfläche, auch leerstehende
4. **Mietverhältnisse** – Mieter, Zeiträume, Personen, Vorauszahlungen
5. **Daten & Sicherung** – Abrechnungszeitraum anlegen, etwa 2024
6. **Kosten** – jede Rechnung als Position
7. **Heizung & Warmwasser** – falls zentral geheizt wird
8. **Verbräuche** – Zählerstände
9. **Rechtsprüfung** – Fehler und Warnungen abarbeiten
10. **Dokument** – Vorschau prüfen und drucken

Ab Schritt 3 gilt alles **je Objekt**. Welches Objekt gemeint ist, wählst du
oben in der Seitenleiste. Für jedes weitere Haus wiederholst du die Schritte
3 bis 10 – die Daten der Objekte bleiben vollständig getrennt.

---

## PDF für den Mieter erzeugen

1. Im Bereich **Dokument** oben auswählen, was gedruckt werden soll:
   alle Mieterabrechnungen, eine einzelne, oder die interne Kostenübersicht
2. Auf **Drucken / als PDF sichern** tippen
3. Im Druckdialog die Seitenvorschau **mit zwei Fingern aufziehen**
4. Oben rechts **Teilen → In Dateien sichern**

Damit hast du eine PDF-Datei im A4-Format, die du per Mail versenden oder
ausdrucken kannst.

> Die **interne Kostenübersicht** stellt umlagefähige und nicht umlagefähige
> Kosten gegenüber und ist ausdrücklich nicht für Mieter bestimmt.

---

## Sicherungen – bitte ernst nehmen

Die Daten liegen im Speicher von Safari. Der kann beim Löschen der
Website-Daten oder durch das System geleert werden. Es gibt keinen Server, der
sie wiederherstellen könnte.

**Daten & Sicherung → Sicherung speichern** → über *Teilen* in **Dateien** oder
**iCloud Drive** ablegen. Über **Sicherung laden** ist alles wieder da.

Sinnvoll: nach jeder größeren Erfassung und immer, bevor du eine Abrechnung
verschickst.

---

## Wenn etwas klemmt

| Beobachtung | Ursache und Abhilfe |
| --- | --- |
| Pages-Einstellung nicht auffindbar | *AA* in der Adresszeile → **Desktop-Website anfordern** |
| Nach dem Speichern 404 | Ein bis drei Minuten warten und neu laden; GitHub baut die Seite erst |
| „Pages is not available for private repositories“ | Repository ist privat, Pages braucht dafür ein kostenpflichtiges Konto |
| Seite lädt, bleibt aber weiß | Prüfen, ob bei *Branch* der richtige Zweig und `/ (root)` gewählt ist |
| „Zum Home-Bildschirm“ fehlt | Die Funktion gibt es nur in Safari |
| Daten nach längerer Pause weg | Sicherung über *Daten & Sicherung → Sicherung laden* zurückspielen |

---

## Was ohne Mac nicht geht

**Den Code ändern.** Änderungswünsche kannst du mir aber jederzeit sagen; ich
passe sie im Repository an, und die veröffentlichte Seite aktualisiert sich
nach ein paar Minuten von selbst. An der Abrechnung selbst fehlt dir nichts.

Alles Fachliche zur Abrechnung steht in [README.md](README.md), die Übersicht
über alle Wege in [START.md](START.md).
