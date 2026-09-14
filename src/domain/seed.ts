/**
 * Demodatenbestand: zwei Projekte, Standard-Prozessketten mit Entscheidungen
 * sowie laufende Planläufe mit Soll-/Ist-Terminen.
 */
import { addDays, today } from '../lib/dates';
import { recalcSollDaten } from './engine';
import {
  DATEN_VERSION,
  EIGENE_ROLLE,
  type AppData,
  type EmailTemplate,
  type ProcessTemplate,
} from './types';

const heute = today();

/* ------------------------------------------------------------------ */
/* Standard-Prozessketten                                              */
/* ------------------------------------------------------------------ */

export const STANDARD_TEMPLATES: ProcessTemplate[] = [
  {
    id: 'tpl-ausfuehrungsplanung',
    projectId: null,
    name: 'Standard-Planlauf Ausführungsplanung',
    beschreibung: 'Regelablauf von der Planerstellung bis zur Freigabe und Verteilung.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl1-s1', name: 'Planerstellung', typ: 'aufgabe', roleName: 'Objektplanung', fristTage: 10, beschreibung: 'Erstellung des Plans in der vereinbarten Detailtiefe.', antworten: [] },
      { id: 'tpl1-s2', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, fristTage: 5, beschreibung: 'Prüfung auf Vollständigkeit und Planungsstand.', antworten: [] },
      {
        id: 'tpl1-s3', name: 'Prüfung ohne Mängel?', typ: 'entscheidung', roleName: EIGENE_ROLLE, fristTage: 0, beschreibung: '',
        antworten: [
          { id: 'tpl1-s3-a1', text: 'Ja', ziel: 'tpl1-s5' },
          { id: 'tpl1-s3-a2', text: 'Nein', ziel: null },
        ],
      },
      { id: 'tpl1-s4', name: 'Überarbeitung', typ: 'aufgabe', roleName: 'Objektplanung', fristTage: 5, beschreibung: 'Einarbeitung der Prüfbemerkungen.', antworten: [] },
      { id: 'tpl1-s5', name: 'Freigabe Bauherr', typ: 'aufgabe', roleName: 'Bauherr', fristTage: 10, beschreibung: 'Freigabe oder Freigabe unter Auflagen.', antworten: [] },
      { id: 'tpl1-s6', name: 'Verteilung an Ausführende', typ: 'sonstiges', roleName: EIGENE_ROLLE, fristTage: 2, beschreibung: '', antworten: [] },
    ],
  },
  {
    id: 'tpl-genehmigung',
    projectId: null,
    name: 'Standard-Planlauf Genehmigungsplanung',
    beschreibung: 'Ablauf für einreichungspflichtige Unterlagen.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl2-s1', name: 'Zusammenstellung Unterlagen', typ: 'aufgabe', roleName: 'Objektplanung', fristTage: 15, beschreibung: '', antworten: [] },
      { id: 'tpl2-s2', name: 'Prüfung Vollständigkeit', typ: 'aufgabe', roleName: EIGENE_ROLLE, fristTage: 5, beschreibung: '', antworten: [] },
      {
        id: 'tpl2-s3', name: 'Unterlagen vollständig?', typ: 'entscheidung', roleName: EIGENE_ROLLE, fristTage: 0, beschreibung: '',
        antworten: [
          { id: 'tpl2-s3-a1', text: 'Ja', ziel: 'tpl2-s5' },
          { id: 'tpl2-s3-a2', text: 'Nein', ziel: null },
        ],
      },
      { id: 'tpl2-s4', name: 'Nachforderung einholen', typ: 'aufgabe', roleName: 'Objektplanung', fristTage: 10, beschreibung: '', antworten: [] },
      { id: 'tpl2-s5', name: 'Einreichung Behörde', typ: 'sonstiges', roleName: EIGENE_ROLLE, fristTage: 3, beschreibung: '', antworten: [] },
      { id: 'tpl2-s6', name: 'Behördliche Genehmigung', typ: 'aufgabe', roleName: 'Behörde', fristTage: 45, beschreibung: 'Gesetzliche Bearbeitungsfrist.', antworten: [] },
    ],
  },
  {
    id: 'tpl-werkplanung',
    projectId: null,
    name: 'Standard-Planlauf Werk- & Montageplanung',
    beschreibung: 'Prüflauf für Planunterlagen ausführender Firmen.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl3-s1', name: 'Einreichung Werkplanung', typ: 'aufgabe', roleName: 'Ausführende Firma', fristTage: 14, beschreibung: '', antworten: [] },
      { id: 'tpl3-s2', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, fristTage: 7, beschreibung: '', antworten: [] },
      {
        id: 'tpl3-s3', name: 'Prüfergebnis', typ: 'entscheidung', roleName: EIGENE_ROLLE, fristTage: 0, beschreibung: '',
        antworten: [
          { id: 'tpl3-s3-a1', text: 'Freigegeben', ziel: 'tpl3-s5' },
          { id: 'tpl3-s3-a2', text: 'Mit Auflagen', ziel: null },
          { id: 'tpl3-s3-a3', text: 'Abgelehnt', ziel: 'ende' },
        ],
      },
      { id: 'tpl3-s4', name: 'Überarbeitung durch Firma', typ: 'aufgabe', roleName: 'Ausführende Firma', fristTage: 10, beschreibung: '', antworten: [] },
      { id: 'tpl3-s5', name: 'Rückgabe an Firma', typ: 'sonstiges', roleName: EIGENE_ROLLE, fristTage: 1, beschreibung: '', antworten: [] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* E-Mail-Vorlagen                                                     */
/* ------------------------------------------------------------------ */

export function standardVorlagen(): EmailTemplate[] {
  const id = () => `mail-${Math.random().toString(36).slice(2, 9)}`;
  return [
    {
      id: id(),
      name: 'Freundliche Erinnerung',
      anlass: 'erinnerung',
      betreff: '[{{projekt.nummer}}] Erinnerung: {{schritt}} – {{plan.nummer}} (fällig {{soll}})',
      text: `{{anrede}}

im Projekt „{{projekt}}“ ({{projekt.nummer}}) steht der Prozessschritt „{{schritt}}“ für den Planlauf „{{planlauf}}“ aus.

  Plan:        {{plan.nummer}} – {{plan}}
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}} ({{frist}})

Bitte geben Sie uns bis zum genannten Termin eine kurze Rückmeldung, damit der weitere Planlauf eingehalten werden kann.

Vielen Dank und freundliche Grüße
{{absender}}`,
    },
    {
      id: id(),
      name: 'Mahnung bei Fristüberschreitung',
      anlass: 'ueberfaellig',
      betreff: '[{{projekt.nummer}}] Überfällig seit {{verzug}} Tagen: {{schritt}} – {{plan.nummer}}',
      text: `{{anrede}}

der Prozessschritt „{{schritt}}“ im Projekt „{{projekt}}“ ({{projekt.nummer}}) ist seit {{verzug}} Tagen überfällig.

  Plan:        {{plan.nummer}} – {{plan}}
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}}

Da der weitere Planlauf hiervon abhängt, bitten wir um Erledigung bis spätestens Ende dieser Woche oder um eine kurze Information, bis wann mit der Rückmeldung zu rechnen ist.

Mit freundlichen Grüßen
{{absender}}`,
    },
    {
      id: id(),
      name: 'Freigabe erteilt',
      anlass: 'freigabe',
      betreff: '[{{projekt.nummer}}] Freigabe: {{plan.nummer}} – {{plan}}',
      text: `{{anrede}}

der Plan {{plan.nummer}} – {{plan}} wurde am {{heute}} freigegeben und kann der Ausführung zugrunde gelegt werden.

Mit freundlichen Grüßen
{{absender}}`,
    },
    {
      id: id(),
      name: 'Versand / Übergabe',
      anlass: 'uebergabe',
      betreff: '[{{projekt.nummer}}] Planversand: {{plan.nummer}} – {{plan}}',
      text: `{{anrede}}

anbei erhalten Sie den Plan {{plan.nummer}} – {{plan}} aus dem Planlauf „{{planlauf}}“ zur weiteren Bearbeitung.

Wir bitten um Rückmeldung bis zum {{soll}}.

Mit freundlichen Grüßen
{{absender}}`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Demodaten                                                           */
/* ------------------------------------------------------------------ */

/** Projektübergreifende Standardrollen, die neue Projekte übernehmen. */
export const STANDARD_ROLLEN = [
  { id: 'srol-plm', name: EIGENE_ROLLE, kuerzel: 'PLM', farbe: '#0071e3', beschreibung: 'Eigene Bearbeitung (Planlaufmanagement)' },
  { id: 'srol-op', name: 'Objektplanung', kuerzel: 'OP', farbe: '#5856d6', beschreibung: '' },
  { id: 'srol-tga', name: 'Fachplanung TGA', kuerzel: 'TGA', farbe: '#ff9500', beschreibung: '' },
  { id: 'srol-twp', name: 'Tragwerksplanung', kuerzel: 'TWP', farbe: '#34c759', beschreibung: '' },
  { id: 'srol-bh', name: 'Bauherr', kuerzel: 'BH', farbe: '#ff3b30', beschreibung: 'Freigabeberechtigt' },
  { id: 'srol-af', name: 'Ausführende Firma', kuerzel: 'AF', farbe: '#af52de', beschreibung: '' },
  { id: 'srol-beh', name: 'Behörde', kuerzel: 'BEH', farbe: '#00a0a0', beschreibung: '' },
];

export function seedData(): AppData {
  const data: AppData = {
    version: DATEN_VERSION,
    bearbeiter: { name: 'PLM', rolle: EIGENE_ROLLE, email: 'planlauf@sander-partner.de' },
    standardRollen: STANDARD_ROLLEN.map((r) => ({ ...r })),
    projects: [
      {
        id: 'prj-1',
        nummer: '2026-014',
        name: 'Neubau Verwaltungsgebäude Nordpark',
        bauherr: 'Nordpark Immobilien GmbH',
        ort: 'Hamburg',
        status: 'aktiv',
        markiert: true,
        start: addDays(heute, -120),
        ende: addDays(heute, 400),
        beschreibung: 'Fünfgeschossiger Verwaltungsneubau mit Tiefgarage.',
        settings: {
          erinnerungVorlaufTage: 5,
          fristenInArbeitstagen: true,
          feiertage: [],
          emailTemplates: standardVorlagen(),
          absenderName: 'Planungsbüro Sander & Partner',
          absenderEmail: 'planlauf@sander-partner.de',
        },
      },
      {
        id: 'prj-2',
        nummer: '2025-208',
        name: 'Sanierung Schulzentrum West',
        bauherr: 'Stadt Lüneburg',
        ort: 'Lüneburg',
        status: 'aktiv',
        markiert: false,
        start: addDays(heute, -300),
        ende: addDays(heute, 180),
        beschreibung: 'Energetische Sanierung im laufenden Betrieb.',
        settings: {
          erinnerungVorlaufTage: 7,
          fristenInArbeitstagen: true,
          feiertage: [],
          emailTemplates: standardVorlagen(),
          absenderName: 'Planungsbüro Sander & Partner',
          absenderEmail: 'planlauf@sander-partner.de',
        },
      },
    ],
    roles: [
      { id: 'rol-1', projectId: 'prj-1', name: EIGENE_ROLLE, kuerzel: 'PLM', farbe: '#0071e3', beschreibung: 'Eigene Bearbeitung (Planlaufmanagement)' },
      { id: 'rol-2', projectId: 'prj-1', name: 'Objektplanung', kuerzel: 'OP', farbe: '#5856d6', beschreibung: '' },
      { id: 'rol-3', projectId: 'prj-1', name: 'Fachplanung TGA', kuerzel: 'TGA', farbe: '#ff9500', beschreibung: '' },
      { id: 'rol-4', projectId: 'prj-1', name: 'Tragwerksplanung', kuerzel: 'TWP', farbe: '#34c759', beschreibung: '' },
      { id: 'rol-5', projectId: 'prj-1', name: 'Bauherr', kuerzel: 'BH', farbe: '#ff3b30', beschreibung: 'Freigabeberechtigt' },
      { id: 'rol-6', projectId: 'prj-1', name: 'Ausführende Firma', kuerzel: 'AF', farbe: '#af52de', beschreibung: '' },
      { id: 'rol-7', projectId: 'prj-1', name: 'Behörde', kuerzel: 'BEH', farbe: '#00a0a0', beschreibung: '' },
      { id: 'rol-8', projectId: 'prj-2', name: EIGENE_ROLLE, kuerzel: 'PLM', farbe: '#0071e3', beschreibung: 'Eigene Bearbeitung' },
      { id: 'rol-9', projectId: 'prj-2', name: 'Objektplanung', kuerzel: 'OP', farbe: '#5856d6', beschreibung: '' },
      { id: 'rol-10', projectId: 'prj-2', name: 'Bauherr', kuerzel: 'BH', farbe: '#ff3b30', beschreibung: 'Gebäudemanagement der Stadt' },
    ],
    contacts: [
      { id: 'con-0', projectId: 'prj-1', anrede: 'Herr', vorname: 'Jonas', nachname: 'Mehltretter', firma: 'Sander & Partner', email: 'j.mehltretter@sander-partner.de', telefon: '+49 40 123456-04', anschrift: 'Hafenstraße 12\n20359 Hamburg', roleIds: ['rol-1'], notiz: 'Planlaufmanagement' },
      { id: 'con-1', projectId: 'prj-1', anrede: 'Frau', vorname: 'Katrin', nachname: 'Berger', firma: 'Sander & Partner', email: 'k.berger@sander-partner.de', telefon: '+49 40 123456-12', anschrift: 'Hafenstraße 12\n20359 Hamburg', roleIds: ['rol-2'], notiz: 'Planverfasserin Grundrisse' },
      { id: 'con-3', projectId: 'prj-1', anrede: 'Herr', vorname: 'Ali', nachname: 'Sarikaya', firma: 'TGA Nord Ingenieure', email: 'sarikaya@tga-nord.de', telefon: '+49 40 998877-3', anschrift: 'Billstraße 88\n20539 Hamburg', roleIds: ['rol-3'], notiz: 'Ansprechpartner Lüftung' },
      { id: 'con-4', projectId: 'prj-1', anrede: 'Frau', vorname: 'Marlene', nachname: 'Hoffstedt', firma: 'Ingenieurbüro Hoffstedt', email: 'm.hoffstedt@ib-hoffstedt.de', telefon: '+49 40 556677-1', anschrift: 'Alsterdorfer Damm 4\n22297 Hamburg', roleIds: ['rol-4'], notiz: '' },
      { id: 'con-5', projectId: 'prj-1', anrede: 'Herr', vorname: 'Robert', nachname: 'Lindqvist', firma: 'Nordpark Immobilien GmbH', email: 'r.lindqvist@nordpark-immobilien.de', telefon: '+49 40 224466-0', anschrift: 'Nordpark 1\n22415 Hamburg', roleIds: ['rol-5'], notiz: 'Freigaben nur donnerstags' },
      { id: 'con-8', projectId: 'prj-1', anrede: 'Herr', vorname: 'Piet', nachname: 'Osterkamp', firma: 'Osterkamp Montagebau', email: 'info@osterkamp-montage.de', telefon: '+49 4101 7788-0', anschrift: 'Industriering 9\n25436 Tornesch', roleIds: ['rol-6'], notiz: '' },
      { id: 'con-6', projectId: 'prj-2', anrede: 'Frau', vorname: 'Yuki', nachname: 'Tanaka', firma: 'Sander & Partner', email: 'y.tanaka@sander-partner.de', telefon: '+49 40 123456-22', anschrift: 'Hafenstraße 12\n20359 Hamburg', roleIds: ['rol-8', 'rol-9'], notiz: '' },
      { id: 'con-7', projectId: 'prj-2', anrede: 'Herr', vorname: 'Dietmar', nachname: 'Krause', firma: 'Stadt Lüneburg, GM', email: 'd.krause@lueneburg.de', telefon: '+49 4131 309-0', anschrift: 'Am Ochsenmarkt 1\n21335 Lüneburg', roleIds: ['rol-10'], notiz: '' },
    ],
    documents: [
      { id: 'doc-1', projectId: 'prj-1', kind: 'paket', parentId: null, nummer: 'PP-AF-01', titel: 'Ausführungsplanung Regelgeschosse', index: 'C', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -20), bemerkung: 'Grundrisse 1.–4. OG' },
      { id: 'doc-2', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', nummer: 'A-GR-102', titel: 'Grundriss 2. Obergeschoss', index: 'C', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -20), bemerkung: '' },
      { id: 'doc-3', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', nummer: 'A-GR-103', titel: 'Grundriss 3. Obergeschoss', index: '', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, 14), bemerkung: '' },
      { id: 'doc-4', projectId: 'prj-1', kind: 'plan', parentId: null, nummer: 'V-SC-201', titel: 'Verkehrsanlage Schnitt A–A', index: '', gewerk: 'VA', planungsphase: 'Entwurfsplanung', eingangSoll: addDays(heute, 30), bemerkung: '' },
      { id: 'doc-5', projectId: 'prj-1', kind: 'verzeichnis', parentId: null, nummer: 'PV-LST', titel: 'Planverzeichnis Leit- und Sicherungstechnik', index: '04', gewerk: 'LST', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, -5), bemerkung: 'Fortschreibung monatlich' },
      { id: 'doc-6', projectId: 'prj-1', kind: 'plan', parentId: 'doc-5', nummer: 'L-SP-410', titel: 'Signalplan Bereich Nord', index: '', gewerk: 'LST', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, 21), bemerkung: '' },
      { id: 'doc-9', projectId: 'prj-1', kind: 'plan', parentId: null, nummer: 'T-KA-050', titel: 'Kabeltrassenplan', index: '', gewerk: 'TK', planungsphase: 'Genehmigungsplanung', eingangSoll: addDays(heute, 45), bemerkung: 'noch nicht im Umlauf' },
      { id: 'doc-7', projectId: 'prj-2', kind: 'paket', parentId: null, nummer: 'PP-BA2', titel: 'Bauabschnitt 2 – Fassade', index: '', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, 10), bemerkung: '' },
      { id: 'doc-8', projectId: 'prj-2', kind: 'plan', parentId: 'doc-7', nummer: 'A-FA-011', titel: 'Fassadenschnitt Nord', index: 'A', gewerk: 'KIB', planungsphase: 'Ausführungsplanung', eingangSoll: addDays(heute, 10), bemerkung: '' },
    ],
    templates: STANDARD_TEMPLATES,
    runs: [
      {
        id: 'run-1',
        projectId: 'prj-1',
        documentId: 'doc-1',
        templateId: 'tpl-ausfuehrungsplanung',
        templateName: 'Standard-Planlauf Ausführungsplanung',
        name: 'Planlauf PP-AF-01 Index C',
        start: addDays(heute, -48),
        status: 'laufend',
        abbruchGrund: null,
        abbruchDatum: null,
        bemerkung: '',
        steps: [
          { id: 'rs-1', name: 'Planerstellung', typ: 'aufgabe', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -30), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-2', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 5, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -22), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          {
            id: 'rs-3', name: 'Prüfung ohne Mängel?', typ: 'entscheidung', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 0, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -22), status: 'erledigt', abweichung: false, bemerkung: 'Kollisionen im Bereich Achse D.', letzteErinnerung: null,
            antworten: [
              { id: 'rs-3-a1', text: 'Ja', ziel: 'rs-5' },
              { id: 'rs-3-a2', text: 'Nein', ziel: null },
            ],
            gewaehlteAntwortId: 'rs-3-a2', durchlauf: 1,
          },
          { id: 'rs-4', name: 'Überarbeitung', typ: 'aufgabe', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 5, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-5', name: 'Freigabe Bauherr', typ: 'aufgabe', roleName: 'Bauherr', contactId: 'con-5', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-6', name: 'Verteilung an Ausführende', typ: 'sonstiges', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 2, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
        ],
      },
      {
        id: 'run-2',
        projectId: 'prj-1',
        documentId: 'doc-5',
        templateId: 'tpl-werkplanung',
        templateName: 'Standard-Planlauf Werk- & Montageplanung',
        name: 'Prüflauf Planverzeichnis LST',
        start: addDays(heute, -6),
        status: 'laufend',
        abbruchGrund: null,
        abbruchDatum: null,
        bemerkung: 'Fristen gegenüber Standard verkürzt (Terminverzug Rohbau).',
        steps: [
          { id: 'rs-8', name: 'Einreichung Werkplanung', typ: 'aufgabe', roleName: 'Ausführende Firma', contactId: 'con-8', fristTage: 7, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -1), status: 'erledigt', abweichung: true, bemerkung: 'Frist von 14 auf 7 Tage verkürzt.', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-9', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 4, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: true, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          {
            id: 'rs-10', name: 'Prüfergebnis', typ: 'entscheidung', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 0, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null,
            antworten: [
              { id: 'rs-10-a1', text: 'Freigegeben', ziel: 'rs-12' },
              { id: 'rs-10-a2', text: 'Mit Auflagen', ziel: null },
              { id: 'rs-10-a3', text: 'Abgelehnt', ziel: 'ende' },
            ],
            gewaehlteAntwortId: null, durchlauf: 1,
          },
          { id: 'rs-11', name: 'Überarbeitung durch Firma', typ: 'aufgabe', roleName: 'Ausführende Firma', contactId: 'con-8', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-12', name: 'Rückgabe an Firma', typ: 'sonstiges', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 1, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
        ],
      },
      {
        id: 'run-3',
        projectId: 'prj-1',
        documentId: 'doc-4',
        templateId: 'tpl-ausfuehrungsplanung',
        templateName: 'Standard-Planlauf Ausführungsplanung',
        name: 'Planlauf V-SC-201',
        start: addDays(heute, -40),
        status: 'abgebrochen',
        abbruchGrund: 'Planinhalt entfällt – Verkehrsanlage wird neu ausgeschrieben.',
        abbruchDatum: addDays(heute, -12),
        bemerkung: '',
        steps: [
          { id: 'rs-20', name: 'Planerstellung', typ: 'aufgabe', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -26), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-21', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, contactId: 'con-0', fristTage: 5, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
        ],
      },
      {
        id: 'run-4',
        projectId: 'prj-2',
        documentId: 'doc-8',
        templateId: 'tpl-ausfuehrungsplanung',
        templateName: 'Standard-Planlauf Ausführungsplanung',
        name: 'Planlauf Fassadenschnitt Nord',
        start: addDays(heute, -3),
        status: 'laufend',
        abbruchGrund: null,
        abbruchDatum: null,
        bemerkung: '',
        steps: [
          { id: 'rs-13', name: 'Planerstellung', typ: 'aufgabe', roleName: 'Objektplanung', contactId: 'con-6', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-14', name: 'Prüfung', typ: 'aufgabe', roleName: EIGENE_ROLLE, contactId: 'con-6', fristTage: 3, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
          { id: 'rs-15', name: 'Freigabe Bauherr', typ: 'aufgabe', roleName: 'Bauherr', contactId: 'con-7', fristTage: 14, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: true, bemerkung: 'Verlängerte Freigabefrist laut Vertrag.', letzteErinnerung: null, antworten: [], gewaehlteAntwortId: null, durchlauf: 1 },
        ],
      },
    ],
  };

  data.runs = data.runs.map((run) => {
    const project = data.projects.find((p) => p.id === run.projectId)!;
    return {
      ...run,
      steps: recalcSollDaten(run.steps, run.start, project.settings.fristenInArbeitstagen, project.settings.feiertage),
    };
  });

  return data;
}
