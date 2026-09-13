# Planlauf-Management

Verwaltungssoftware für Planläufe: Projekte, Planpakete/Pläne/Planverzeichnisse und die
Prozessketten, die diese durchlaufen – mit Soll-/Ist-Terminen, Fristenüberwachung und
vorbereiteten Erinnerungs-E-Mails.

Dieser Stand ist ein **lauffähiger Prototyp ohne Datenbank**: Alle Daten liegen lokal im Browser
(`localStorage`). Das Datenmodell ist bereits so geschnitten, dass es später ohne Änderungen an
der Oberfläche auf eine relationale Datenbank umgestellt werden kann.

## Starten

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:5173
npm run build    # Produktionsbuild nach dist/
npm run preview  # Produktionsbuild lokal ansehen
npm run typecheck
```

Beim ersten Start wird ein Demodatenbestand mit zwei Projekten, Adressbüchern, Plänen und
laufenden Planläufen geladen. Über **Zurücksetzen** (unten in der Seitenleiste) lässt sich dieser
Stand jederzeit wiederherstellen, über **Export** der gesamte Bestand als JSON sichern.

## Funktionsumfang

### Projekte
Anlage und Pflege von Projekten (Nummer, Bauherr, Ort, Laufzeit, Status). Beim Anlegen werden
Standardrollen und E-Mail-Vorlagen vorbelegt.

### Rollen & Adressbuch
Je Projekt frei definierbare Rollen (z.B. Objektplanung, Prüfstatiker, Bauherr) mit Farbe und
Kürzel. Kontakte werden einer oder mehreren Rollen zugeordnet. Über die Rolle findet die
Anwendung beim Start eines Planlaufs automatisch die zuständige Person.

### Pläne, Planpakete, Planverzeichnisse
Hierarchischer Planbestand: Planpakete und Planverzeichnisse können Pläne enthalten. Je Eintrag
werden Nummer, Titel, Index, Maßstab, Gewerk, Status und verantwortliche Person geführt.

### Prozessketten
* Drei **Standardketten** (Ausführungsplanung, Genehmigungsplanung, Werk- & Montageplanung),
  die den mitgelieferten BPMN-Diagrammen entsprechen.
* **BPMN-2.0-Import**: `.bpmn`/`.xml`-Datei per Drag & Drop einlesen. Ausgewertet werden
  Aktivitäten und Gateways entlang der Sequenzflüsse, Lanes als Rollen sowie Fristen aus
  Attributen (`frist="5"`), Extension-Properties oder ISO-8601-Dauern (`P5D`). Vor der Übernahme
  lassen sich Rollen und Fristen in einer Vorschautabelle korrigieren.
  Beispieldateien liegen unter [`beispiele/`](beispiele/).
* Ketten lassen sich duplizieren und als **Projektvariante** abweichend pflegen.

### Planläufe (Soll-/Ist-Termine)
Ein Planlauf ist die laufende Instanz einer Prozesskette für einen Plan, ein Paket oder ein
Verzeichnis. Beim Start werden die Schritte der Vorlage kopiert – **individuelle Abweichungen
wirken deshalb nur auf den jeweiligen Lauf** und sind als solche gekennzeichnet.

* **Soll-Termine** werden aus den Fristen gerechnet: Soll = Soll des Vorgängers + Frist. Wahlweise
  in Arbeitstagen (Mo–Fr, ohne hinterlegte Feiertage) oder Kalendertagen.
* Ein Soll-Termin kann **manuell festgesetzt** werden und bildet dann die Basis für alle folgenden
  Schritte.
* **Ist-Termine** dokumentieren die Erledigung; der jeweils nächste Schritt wird automatisch aktiv,
  der Lauf schließt sich, wenn alle Schritte erledigt sind.
* Schritte lassen sich im Lauf einfügen, verschieben, löschen und in Frist, Rolle und Zuständigkeit
  ändern.

### Fristen & Erinnerungen
Zentrale Fristenübersicht über alle Projekte, sortiert nach Dringlichkeit und gefiltert nach
überfällig / fällig / im Plan. Ein Schritt gilt als *fällig*, sobald der Soll-Termin näher liegt als
die in den Projekteinstellungen gepflegte Vorlaufzeit.

Je Schritt bereitet der Button **Erinnern** eine E-Mail vor: Die zur Lage passende Vorlage
(Erinnerung oder Mahnung) wird ausgewählt, die Platzhalter aus Projekt, Plan, Schritt, Frist und
Empfänger ersetzt. Die Mail kann im lokalen E-Mail-Programm geöffnet (`mailto:`) oder in die
Zwischenablage kopiert werden; der Zeitpunkt wird am Schritt vermerkt.

### Projekteinstellungen
Vorlaufzeit für Erinnerungen, Arbeitstage/Feiertage, Absenderangaben sowie die
**E-Mail-Vorlagen** (Betreff und Text) mit einer Übersicht aller verfügbaren Platzhalter.

## Aufbau des Codes

```
src/
  domain/        Fachlogik ohne UI-Bezug
    types.ts     Datenmodell (Projekt, Rolle, Kontakt, Plan, Vorlage, Planlauf …)
    engine.ts    Fristenrechnung, Ampelstatus, offene Fristen
    bpmn.ts      Import von BPMN-2.0-Diagrammen
    email.ts     Platzhalter und Aufbereitung der Vorlagen
    seed.ts      Standard-Prozessketten und Demodaten
  store/
    storage.ts   Persistenz (localStorage) – Austauschpunkt für eine spätere Datenbank
    store.tsx    Zentraler Zustand, alle Schreibzugriffe
  pages/         Ansichten (Dashboard, Fristen, Projekte, Prozessketten, Projektreiter)
  components/    Wiederverwendbare Bausteine (ui.tsx, icons.tsx, EmailDialog …)
  styles/        Design-Tokens im hellen Apple-Erscheinungsbild
```

## Gestaltung

Helles Erscheinungsbild in Anlehnung an Apple: Systemschriftart (SF Pro / `-apple-system`),
zurückhaltende Flächen auf `#f5f5f7`, weiße Karten mit weichen Radien und feinen Schatten,
Systemblau `#0071e3` als Akzent, transluzente Seitenleiste und Kopfzeile, Segmented Controls und
Pill-Buttons. Die Oberfläche ist bis auf Telefonbreite (~400 px) nutzbar.

## Nächste Schritte (Ausblick)

* Ablösung von `storage.ts` durch eine Datenbank (z.B. PostgreSQL) samt API – das Datenmodell in
  `domain/types.ts` ist bereits auf Tabellen mit ID-Referenzen ausgelegt.
* Mehrbenutzerbetrieb mit Anmeldung und Rechten je Rolle.
* Automatischer Mailversand über SMTP statt `mailto:` inkl. Erinnerungslauf im Hintergrund.
* Dateiablage für die eigentlichen Plandateien (PDF/DWG) je Index.
* Auswertungen: Terminlisten, Planlieferlisten und Verzugsberichte als Export.
