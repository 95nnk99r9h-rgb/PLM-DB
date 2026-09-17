# Inventar der Anwendung

Stand: Quellcode dieses Repositorys (Branch `claude/planlauf-management-app-5jn9sa`).
Alle Angaben sind aus dem Code abgeleitet; Dateipfade in Klammern verweisen auf die Fundstelle.

## 1. Zweck der Anwendung

MC Plan ist eine Verwaltungssoftware für das Planlaufmanagement im Bau- und Bahnumfeld: Zu jedem
Projekt werden Pläne, Planverzeichnisse und Planpakete geführt, die vordefinierte Workflows
(Prozessketten) mit Soll- und Ist-Terminen durchlaufen (`src/domain/types.ts`, `src/domain/seed.ts`).
Die Anwendung überwacht die Fristen dieser Prozessschritte, weist jeden Schritt über Funktionen je
Gewerk einer Person aus dem Projektadressbuch zu und bereitet Erinnerungs-E-Mails aus Vorlagen vor
(`src/domain/engine.ts`, `src/domain/email.ts`).
Sie läuft als reine Browseranwendung ohne Server: Der gesamte Datenbestand liegt im `localStorage`
des Browsers, wobei die Schnittstelle in `src/store/storage.ts` bewusst schmal gehalten ist, um
später gegen eine Datenbank getauscht zu werden.

## 2. Routen und Seiten

Die Adressierung läuft über einen Hash-Router (`src/lib/router.ts`). Unbekannte Adressen führen auf
die Übersicht; die frühere Adresse `…/planlaeufe` wird auf die Planliste umgeleitet.

### Hauptbereiche (Seitenleiste)

| Route | Seite | Inhalt und mögliche Aktionen |
| --- | --- | --- |
| `#/dashboard` (auch leerer Hash) | Übersicht (`src/pages/Dashboard.tsx`) | Kacheln (laufende Planläufe, überfällige Schritte, eigene To-Dos, demnächst fällig), Liste der eigenen To-Dos mit Schaltflächen „Erinnerung vorbereiten“ und „Erledigt“, Tabelle aller (markierten) Projekte mit Anzahl Pläne/Verzeichnisse, laufenden Planläufen, fälligen und überfälligen Schritten, Fortschrittsbalken und Verweis „Projekt öffnen“. Angezeigt werden markierte Projekte; ohne Markierung alle. |
| `#/projekte` | Projekte (`src/pages/Projekte.tsx`) | Projektliste; neues Projekt anlegen, Projekt bearbeiten, Projekt mit ★ markieren bzw. Markierung aufheben, Projekt öffnen. |
| `#/ketten` | Workflows (`src/pages/Workflows.tsx`) | Standard-Workflows und Projektvarianten ansehen; neue Kette anlegen, Kette duplizieren, bearbeiten, löschen; Schritte hinzufügen/ändern/entfernen (Art Aufgabe/Entscheidung/Sonstiges, Verantwortliche Funktion, Frist in Tagen, Nachweis, Nachfolger bzw. Antwortziele bei Entscheidungen). |
| `#/rollen` | Funktionen (`src/pages/Funktionen.tsx`) | Projektübergreifende Funktionen, gegliedert in „Übergreifend“ und je Gewerk; neue Funktion anlegen, vorhandene Funktion in ein weiteres Gewerk übernehmen, bearbeiten, löschen. |
| `#/vorlagen` | Vorlagen (`src/pages/Vorlagen.tsx`) | Zwei Bereiche: **E-Mail-Texte** (Vorlagen anlegen, bearbeiten, löschen; Editor mit Bausteinen aus `PLATZHALTER` und Vorschau mit Beispielwerten) und **Excel-Vorlagen** (Planliste und Adressliste als `.xlsx` herunterladen, Spaltenerläuterung). |
| `#/fristen` | Fristen & Erinnerungen (`src/pages/Fristen.tsx`) | Nicht in der Seitenleiste verlinkt, aber über die Kacheln der Übersicht erreichbar: je Planlauf der aktuell anstehende Schritt, filterbar nach Überfällig/Fällig/Im Plan, durchsuchbar; Schaltflächen „Erinnern“ (E-Mail-Dialog) und „Erledigt“. |

### Projektbereich `#/projekt/<projectId>/<tab>`

| Reiter | Seite | Inhalt und mögliche Aktionen |
| --- | --- | --- |
| `uebersicht` | Projektübersicht (`src/pages/projekt/Uebersicht.tsx`) | Kennzahlenleiste (Planpakete, Planverzeichnisse, Pläne, fällige und überfällige Schritte) mit Gesamtfortschrittsbalken; Liste der Planläufe (laufend, abgeschlossen, abgebrochen) gegliedert nach Planpaketen. Umschalten der Gliederung („Planpakete“ / „+ Pläne & Verzeichnisse“), Schalter „Untergeordnete Pläne anzeigen“, Auf- und Zuklappen einzelner Pakete und Verzeichnisse, „Erinnern“, „Erledigt“, Planlauf öffnen. |
| `plaene` | Planliste (`src/pages/projekt/Plaene.tsx`) | Alle Pläne und Planverzeichnisse mit laufender Nummer, Art, Bezeichnung/Titel, Gewerk, zugehörigem Planverzeichnis, Planpaket und Eingang Soll. Filter (Alle/Pläne/Verzeichnisse), Suche, Sortierung je Spalte; Eintrag anlegen (mit Start des Planlaufs aus einem Workflow), bearbeiten, löschen; Planverzeichnis oder Planpaket direkt aus den Auswahlfeldern neu anlegen; Excel-Import (`PlaeneImport.tsx`). |
| `pakete` | Planpakete (`src/pages/projekt/Planpakete.tsx`) | Planpakete anlegen, bearbeiten, löschen; Inhalt aufklappen, Pläne und Planverzeichnisse zuordnen und wieder entfernen. Ordnungsmerkmal ohne Einfluss auf Planläufe. |
| `adressbuch` | Adressbuch (`src/pages/projekt/Adressbuch.tsx`) | Kontakte des Projekts anlegen, bearbeiten, löschen; je Kontakt mehrere Funktionen (Gewerk + Funktion) zuweisen und entfernen; Suche; Excel-Import (`KontakteImport.tsx`). |
| `ketten` | Workflows im Projekt (`src/pages/Workflows.tsx` mit `projectId`) | Wie der globale Workflow-Bereich, zusätzlich beschränkt auf Standardketten und Varianten dieses Projekts. |
| `einstellungen` | Einstellungen (`src/pages/projekt/Einstellungen.tsx`) | Projektdaten bearbeiten; Vorlaufzeit für Erinnerungen, Fristenrechnung in Arbeitstagen, Feiertage, Absendername und Absender-E-Mail pflegen; Hinweis auf die projektübergreifenden E-Mail-Texte; Projekt löschen. |

Über allen Reitern steht die Schaltfläche **Export** (`ExportDialog.tsx`): Auswahl der Einträge,
Kurz- oder Langfassung, Ausgabe als Excel-Datei (`src/lib/xlsx.ts`) oder als PDF über den
Druckdialog des Browsers (`src/lib/print.ts`).

### Planlaufdetail `#/projekt/<projectId>/planlauf/<runId>`

`src/pages/projekt/PlanlaufDetail.tsx`: Kopf mit Eintrag, Index/Ausgabe, Start und Vorlage; darunter
die Prozessschritte. Der aktuelle Schritt zeigt Verantwortliche Funktion, Person, Frist, Soll- und
Ist-Termin sowie die Schaltflächen **Erledigt**, **Überspringen** und **Erinnern**; erledigte und
künftige Schritte sind auf Nummer und Titel reduziert und lassen sich aufklappen (dort **Wieder
öffnen**). Weitere Aktionen: Schritt anpassen (Stift), **Schritt einfügen**, Antwort einer
Entscheidung wählen, **Planlauf abbrechen** (ersatzlos oder mit neuem Index bzw. neuer Ausgabe – dann
startet ein Nachfolgelauf) und **Lauf löschen**. Verlangt ein Schritt einen Nachweis, wird beim
Erledigen die Freigabe- oder Prüfbericht-Nummer abgefragt (`src/components/SchrittStatus.tsx`).

### Seitenleiste unten

Angemeldete Person (Name, eigene Rolle, E-Mail, Schalter für die Mailnachfrage), **Sicherung**
(Datenbestand als JSON herunterladen, `exportiereDaten` in `src/store/storage.ts`) und
**Zurücksetzen** (Bestand löschen und Demodaten laden, `zuruecksetzen` in `src/store/store.tsx`).

## 3. Nutzerrollen und Rechte

**Es gibt keine Anmeldung, keine Benutzerverwaltung und keine Rechteprüfung im Code.** Weder in
`src/App.tsx` noch im Store (`src/store/store.tsx`) existiert eine Prüfung, die eine Aktion abhängig
von einer Rolle zulässt oder verweigert. Jede Person, die die Anwendung im Browser öffnet, kann
alles lesen und ändern; die Hinweise in der Oberfläche formulieren das ausdrücklich („Alle
Bearbeiter sehen alle Projekte“, `src/pages/Projekte.tsx`).

Der Begriff „Rolle“ hat im Code zwei rein fachliche Bedeutungen:

1. **Bearbeiter** (`Bearbeiter` in `src/domain/types.ts`): Name, eigene Rolle (Vorgabe
   `EIGENE_ROLLE = 'Planlaufmanagement'`), E-Mail und die Einstellung `mailNachfrage`. Die eigene
   Rolle steuert allein, welche Prozessschritte als eigene To-Dos gelten (`eigeneTodos` in
   `src/domain/engine.ts`) und ob nach dem Erledigen eines Schritts eine E-Mail angeboten wird
   (`src/components/SchrittStatus.tsx`). Sie verleiht keine Rechte.
2. **Funktionen** (`StandardRolle` projektübergreifend, `Role` je Projekt): fachliche Zuständigkeiten
   je Gewerk, die Prozessschritten zugeordnet und im Adressbuch mit Personen besetzt werden
   (`kontaktFuerRolleUndGewerk` in `src/domain/engine.ts`). Mitgeliefert werden 15 Funktionen
   (`src/domain/seed.ts`), davon zwei übergreifend (Planlaufmanagement, Projektleitung) und
   dreizehn je Gewerk (Fachplaner, Fachspezialist, Bauvorlageberechtiger, Bau AN, Bauüberwachung,
   Fachtechnischer Prüfer, Prüfstatiker, Vermessungsprüfer, Erdungsprüfer, Schweißtechnischer
   Prüfer, Korrosionsschutzprüfer, Gleisgeometrie Prüfer, Geotechnischer Prüfer) für die Gewerke
   EEA, KIB, LST, OLA, OSE, TK und VA.

## 4. Umgebungsvariablen

**Eine Datei `.env.example` existiert in diesem Repository nicht; es gibt auch keine `.env`-Datei und
keine eigenen Umgebungsvariablen.** Weder `vite.config.ts` noch der Quellcode lesen projekteigene
Variablen aus `import.meta.env` oder `process.env`.

Genutzt werden ausschließlich zwei von Vite bereitgestellte Werte, die keine Konfiguration
erfordern:

| Wert | Verwendung | Pflicht |
| --- | --- | --- |
| `import.meta.env.BASE_URL` | Pfad zur Wortmarke `public/mailaender-consult.svg` (`src/components/logos.tsx`). Wird von Vite aus `base: './'` in `vite.config.ts` gesetzt. | entfällt – von Vite gesetzt |
| `import.meta.env.PROD` | Registriert den Service Worker nur im gebauten Stand (`src/lib/pwa.ts`). | entfällt – von Vite gesetzt |

## 5. Setup von Null bis laufender Anwendung

Voraussetzung ist Node.js; die Veröffentlichung nutzt Node 22 (`.github/workflows/pages.yml`).
Laufzeitabhängigkeiten sind allein `react` und `react-dom`; Excel- und PDF-Ausgabe sind ohne weitere
Bibliotheken umgesetzt (`package.json`).

```bash
git clone <Repository-URL>
cd PLM-DB
npm ci            # Abhängigkeiten installieren (alternativ: npm install)
npm run dev       # Entwicklungsserver von Vite, Ausgabe nennt die Adresse
```

Für einen produktiven Stand:

```bash
npm run build     # prüft die Typen (tsc -b) und baut nach dist/
npm run preview   # liefert dist/ lokal aus
```

Weitere Skripte: `npm run typecheck` (`tsc --noEmit`).

**Datenbank und Migrationen:** Es gibt keine Datenbank, keinen Server und keine
Datenbank-Migrationen. Der Bestand liegt im `localStorage` unter dem Schlüssel
`planlauf-management.data.v1` (`src/store/storage.ts`). Beim ersten Start wird ein Demodatenbestand
erzeugt (`seedData` in `src/domain/seed.ts`). Für ältere Bestände enthält `storage.ts` eine
Migration auf die aktuelle Fassung: `DATEN_VERSION = 7` für den Datenbestand und
`STAMMDATEN_VERSION = 4` für die mitgelieferten Funktionen und Standard-Workflows
(`src/domain/types.ts`). Diese Migration läuft automatisch beim Laden; es ist kein Befehl
aufzurufen.

**Veröffentlichung auf GitHub Pages:** Der Workflow `.github/workflows/pages.yml` baut bei jedem
Push auf `main` oder den Entwicklungsbranch, lädt `dist/` als Pages-Artefakt hoch, legt den Build
zusätzlich im Ordner `app/` des Branches ab und aktualisiert den Branch `gh-pages`.

## 6. Bekannte Fehlermeldungen und ihre Ursachen

### Beim Start

| Meldung | Ursache |
| --- | --- |
| „MC Plan wird geladen …“ bleibt stehen | Der Quellcode wird statisch ausgeliefert statt der gebauten Anwendung. `index.html` wechselt nach 1,5 Sekunden automatisch auf `./app/`; fehlt auch diese Fassung, bleibt der Hinweis stehen. Abhilfe laut Text: auf GitHub Pages **Settings → Pages → Build and deployment → Source: GitHub Actions**, lokal `npm run dev` oder `npm run build`. |
| `useStore muss innerhalb des StoreProvider verwendet werden.` | Eine Komponente nutzt `useStore()` außerhalb von `<StoreProvider>` (`src/store/store.tsx`). Nur bei Programmierfehlern. |

### Beim Speichern und beim Service Worker (Browserkonsole)

| Meldung | Ursache |
| --- | --- |
| `Daten konnten nicht lokal gespeichert werden: …` | `localStorage.setItem` schlug fehl, etwa weil der Speicher voll ist oder der Browser ihn sperrt (privates Fenster, blockierte Website-Daten) – `src/store/storage.ts`. |
| `Service Worker konnte nicht registriert werden: …` | Registrierung von `sw.js` fehlgeschlagen, etwa ohne HTTPS oder bei fehlender Datei – `src/lib/pwa.ts`. |

### Beim Excel-Import (`src/lib/xlsxLesen.ts`, `PlaeneImport.tsx`, `KontakteImport.tsx`)

| Meldung | Ursache |
| --- | --- |
| `Die Datei ist keine gültige Excel-Datei (ZIP-Ende fehlt).` | Die Datei ist kein ZIP-Container, also keine `.xlsx`-Datei (z. B. altes `.xls` oder umbenannte Datei). |
| `Die Datei verwendet ein nicht unterstütztes Packverfahren.` | Der Eintrag im ZIP ist weder unkomprimiert noch mit „deflate“ gepackt. |
| `Dieser Browser kann keine Excel-Dateien entpacken – bitte die Liste als CSV speichern.` | Der Browser kennt `DecompressionStream('deflate-raw')` nicht. |
| `Die Datei enthält keine Datenzeilen.` | Die Tabelle hat nur eine Kopfzeile oder ist leer. |
| `Die Spalte „Nachname“ wurde nicht gefunden. Gelesene Überschriften: …` | Im Kontaktimport fehlt die Pflichtspalte „Name“ bzw. „Nachname“. |
| `Weder „Plancodierung“ noch „Titel“ gefunden. Gelesene Überschriften: …` | Im Planimport fehlen beide Spalten, aus denen die Bezeichnung gebildet wird. |
| `Die Datei konnte nicht gelesen werden.` | Auffangmeldung für alle übrigen Lesefehler. |

Hinweise in der Vorschau des Imports (kein Abbruch, die Zeile wird trotzdem übernommen):
„Kontakt ist bereits im Projekt vorhanden“, „Eintrag mit dieser Bezeichnung ist bereits vorhanden“,
„nur Pläne können einem Planverzeichnis zugeordnet werden“, „Planpaket „…“ wird angelegt“,
„Planverzeichnis „…“ wird angelegt“, „Workflow „…“ ist nicht hinterlegt“, „Übergreifende Funktion
„…“ ist im Projekt nicht hinterlegt“ bzw. „„…“ ist für <Gewerk> nicht hinterlegt“.

### Pflichtangaben in Dialogen (Kurzmeldung, Speichern wird abgelehnt)

„Bitte einen Projektnamen angeben.“ · „Bitte einen Titel angeben.“ · „Bitte eine Bezeichnung
angeben.“ · „Bitte einen Namen angeben.“ · „Bitte einen Namen für das Planpaket angeben.“ · „Bitte
einen Nachnamen angeben.“ · „Bitte jeden Schritt benennen.“ bzw. „Bitte jeden Schritt der Workflow
benennen.“ · „Bitte einen Grund angeben.“ und „Bitte <Index bzw. Ausgabe> angeben.“ beim Abbruch eines
Planlaufs · „Bitte die <Freigabe-Nr. bzw. Prüfbericht-Nr.> angeben.“ beim Erfassen eines Nachweises ·
„Bitte mindestens einen Eintrag auswählen.“ im Export.
