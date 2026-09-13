/**
 * Demodatenbestand: zwei Projekte, Standard-Prozessketten (entsprechend den
 * BPMN-2.0-Standardketten) sowie laufende Planläufe mit Soll-/Ist-Terminen.
 */
import { addDays, today } from '../lib/dates';
import { recalcSollDaten } from './engine';
import type { AppData, EmailTemplate, ProcessTemplate } from './types';

const heute = today();
const t = (tage: number) => addDays(heute, tage);

export const STANDARD_TEMPLATES: ProcessTemplate[] = [
  {
    id: 'tpl-ausfuehrungsplanung',
    projectId: null,
    name: 'Standard-Planlauf Ausführungsplanung',
    beschreibung: 'Regelablauf von der Planerstellung bis zur Freigabe und Verteilung.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl1-s1', name: 'Planerstellung', typ: 'task', roleName: 'Objektplanung', fristTage: 10, beschreibung: 'Erstellung des Plans in der vereinbarten Detailtiefe.' },
      { id: 'tpl1-s2', name: 'Interne Prüfung', typ: 'review', roleName: 'Projektleitung', fristTage: 3, beschreibung: 'Vier-Augen-Prinzip vor Versand an Dritte.' },
      { id: 'tpl1-s3', name: 'Versand an Fachplaner', typ: 'versand', roleName: 'Projektsteuerung', fristTage: 1, beschreibung: '' },
      { id: 'tpl1-s4', name: 'Fachplanerprüfung', typ: 'review', roleName: 'Fachplanung TGA', fristTage: 10, beschreibung: 'Rückmeldung mit Kommentaren.' },
      { id: 'tpl1-s5', name: 'Einarbeitung Kommentare', typ: 'task', roleName: 'Objektplanung', fristTage: 5, beschreibung: '' },
      { id: 'tpl1-s6', name: 'Freigabe Bauherr', typ: 'freigabe', roleName: 'Bauherr', fristTage: 10, beschreibung: 'Freigabe oder Freigabe unter Auflagen.' },
      { id: 'tpl1-s7', name: 'Verteilung an Ausführende', typ: 'versand', roleName: 'Projektsteuerung', fristTage: 2, beschreibung: '' },
    ],
  },
  {
    id: 'tpl-genehmigung',
    projectId: null,
    name: 'Standard-Planlauf Genehmigungsplanung',
    beschreibung: 'Ablauf für einreichungspflichtige Unterlagen inkl. Prüfstatik.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl2-s1', name: 'Zusammenstellung Unterlagen', typ: 'task', roleName: 'Objektplanung', fristTage: 15, beschreibung: '' },
      { id: 'tpl2-s2', name: 'Prüfung Vollständigkeit', typ: 'review', roleName: 'Projektleitung', fristTage: 5, beschreibung: '' },
      { id: 'tpl2-s3', name: 'Prüfstatik', typ: 'review', roleName: 'Tragwerksplanung', fristTage: 20, beschreibung: '' },
      { id: 'tpl2-s4', name: 'Vollständig?', typ: 'gateway', roleName: 'Projektleitung', fristTage: 0, beschreibung: 'Bei Nachforderung zurück an Zusammenstellung.' },
      { id: 'tpl2-s5', name: 'Einreichung Behörde', typ: 'versand', roleName: 'Projektleitung', fristTage: 3, beschreibung: '' },
      { id: 'tpl2-s6', name: 'Behördliche Genehmigung', typ: 'freigabe', roleName: 'Behörde', fristTage: 45, beschreibung: 'Gesetzliche Bearbeitungsfrist.' },
    ],
  },
  {
    id: 'tpl-werkplanung',
    projectId: null,
    name: 'Standard-Planlauf Werk- & Montageplanung',
    beschreibung: 'Prüfläufe für Planunterlagen ausführender Firmen.',
    herkunft: 'standard',
    steps: [
      { id: 'tpl3-s1', name: 'Einreichung Werkplanung', typ: 'task', roleName: 'Ausführende Firma', fristTage: 14, beschreibung: '' },
      { id: 'tpl3-s2', name: 'Prüfung Objektplanung', typ: 'review', roleName: 'Objektplanung', fristTage: 7, beschreibung: '' },
      { id: 'tpl3-s3', name: 'Prüfung Fachplanung', typ: 'review', roleName: 'Fachplanung TGA', fristTage: 7, beschreibung: '' },
      { id: 'tpl3-s4', name: 'Freigabevermerk', typ: 'freigabe', roleName: 'Projektleitung', fristTage: 3, beschreibung: '' },
      { id: 'tpl3-s5', name: 'Rückgabe an Firma', typ: 'versand', roleName: 'Projektsteuerung', fristTage: 1, beschreibung: '' },
    ],
  },
];

const STANDARD_MAILS = (): EmailTemplate[] => [
  {
    id: 'mail-erinnerung',
    name: 'Freundliche Erinnerung',
    anlass: 'erinnerung',
    betreff: '[{{projekt.nummer}}] Erinnerung: {{schritt}} – {{plan.nummer}} (fällig {{soll}})',
    text: `{{anrede}}

im Projekt „{{projekt}}“ ({{projekt.nummer}}) steht der Prozessschritt „{{schritt}}“ für den Planlauf „{{planlauf}}“ aus.

  Plan:        {{plan.nummer}} – {{plan}} (Index {{plan.index}})
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}} ({{frist}})

Bitte geben Sie uns bis zum genannten Termin eine kurze Rückmeldung, damit der weitere Planlauf eingehalten werden kann.

Vielen Dank und freundliche Grüße
{{absender}}`,
  },
  {
    id: 'mail-ueberfaellig',
    name: 'Mahnung bei Fristüberschreitung',
    anlass: 'ueberfaellig',
    betreff: '[{{projekt.nummer}}] Überfällig seit {{verzug}} Tagen: {{schritt}} – {{plan.nummer}}',
    text: `{{anrede}}

der Prozessschritt „{{schritt}}“ im Projekt „{{projekt}}“ ({{projekt.nummer}}) ist seit {{verzug}} Tagen überfällig.

  Plan:        {{plan.nummer}} – {{plan}} (Index {{plan.index}})
  Ihre Rolle:  {{rolle}}
  Soll-Termin: {{soll}}

Da der weitere Planlauf hiervon abhängt, bitten wir um Erledigung bis spätestens Ende dieser Woche oder um eine kurze Information, bis wann mit der Rückmeldung zu rechnen ist.

Mit freundlichen Grüßen
{{absender}}`,
  },
  {
    id: 'mail-freigabe',
    name: 'Freigabe erteilt',
    anlass: 'freigabe',
    betreff: '[{{projekt.nummer}}] Freigabe: {{plan.nummer}} – {{plan}} (Index {{plan.index}})',
    text: `{{anrede}}

der Plan {{plan.nummer}} – {{plan}} (Index {{plan.index}}) wurde am {{heute}} freigegeben und kann der Ausführung zugrunde gelegt werden.

Mit freundlichen Grüßen
{{absender}}`,
  },
  {
    id: 'mail-uebergabe',
    name: 'Versand / Übergabe',
    anlass: 'uebergabe',
    betreff: '[{{projekt.nummer}}] Planversand: {{plan.nummer}} – {{plan}}',
    text: `{{anrede}}

anbei erhalten Sie den Plan {{plan.nummer}} – {{plan}} (Index {{plan.index}}) aus dem Planlauf „{{planlauf}}“ zur weiteren Bearbeitung.

Wir bitten um Rückmeldung bis zum {{soll}}.

Mit freundlichen Grüßen
{{absender}}`,
  },
];

export function seedData(): AppData {
  const data: AppData = {
    version: 1,
    projects: [
      {
        id: 'prj-1',
        nummer: '2026-014',
        name: 'Neubau Verwaltungsgebäude Nordpark',
        bauherr: 'Nordpark Immobilien GmbH',
        ort: 'Hamburg',
        status: 'aktiv',
        start: addDays(heute, -120),
        ende: addDays(heute, 400),
        beschreibung: 'Fünfgeschossiger Verwaltungsneubau mit Tiefgarage, LPH 5–8.',
        settings: {
          erinnerungVorlaufTage: 5,
          fristenInArbeitstagen: true,
          feiertage: [],
          emailTemplates: STANDARD_MAILS(),
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
        start: addDays(heute, -300),
        ende: addDays(heute, 180),
        beschreibung: 'Energetische Sanierung im laufenden Betrieb, bauabschnittsweise.',
        settings: {
          erinnerungVorlaufTage: 7,
          fristenInArbeitstagen: true,
          feiertage: [],
          emailTemplates: STANDARD_MAILS(),
          absenderName: 'Planungsbüro Sander & Partner',
          absenderEmail: 'planlauf@sander-partner.de',
        },
      },
    ],
    roles: [
      { id: 'rol-1', projectId: 'prj-1', name: 'Objektplanung', kuerzel: 'OP', farbe: '#0071e3', beschreibung: 'Architektur, LPH 5' },
      { id: 'rol-2', projectId: 'prj-1', name: 'Projektleitung', kuerzel: 'PL', farbe: '#5856d6', beschreibung: 'Interne Leitung' },
      { id: 'rol-3', projectId: 'prj-1', name: 'Fachplanung TGA', kuerzel: 'TGA', farbe: '#ff9500', beschreibung: 'Heizung, Lüftung, Sanitär, Elektro' },
      { id: 'rol-4', projectId: 'prj-1', name: 'Tragwerksplanung', kuerzel: 'TWP', farbe: '#34c759', beschreibung: '' },
      { id: 'rol-5', projectId: 'prj-1', name: 'Bauherr', kuerzel: 'BH', farbe: '#ff3b30', beschreibung: 'Freigabeberechtigt' },
      { id: 'rol-6', projectId: 'prj-1', name: 'Projektsteuerung', kuerzel: 'PS', farbe: '#af52de', beschreibung: '' },
      { id: 'rol-7', projectId: 'prj-2', name: 'Objektplanung', kuerzel: 'OP', farbe: '#0071e3', beschreibung: '' },
      { id: 'rol-8', projectId: 'prj-2', name: 'Projektleitung', kuerzel: 'PL', farbe: '#5856d6', beschreibung: '' },
      { id: 'rol-9', projectId: 'prj-2', name: 'Bauherr', kuerzel: 'BH', farbe: '#ff3b30', beschreibung: 'Gebäudemanagement der Stadt' },
    ],
    contacts: [
      { id: 'con-1', projectId: 'prj-1', anrede: 'Frau', vorname: 'Katrin', nachname: 'Berger', firma: 'Sander & Partner', email: 'k.berger@sander-partner.de', telefon: '+49 40 123456-12', roleIds: ['rol-1'], notiz: 'Planverfasserin Grundrisse' },
      { id: 'con-2', projectId: 'prj-1', anrede: 'Herr', vorname: 'Jonas', nachname: 'Mehltretter', firma: 'Sander & Partner', email: 'j.mehltretter@sander-partner.de', telefon: '+49 40 123456-04', roleIds: ['rol-2', 'rol-6'], notiz: '' },
      { id: 'con-3', projectId: 'prj-1', anrede: 'Herr', vorname: 'Ali', nachname: 'Sarikaya', firma: 'TGA Nord Ingenieure', email: 'sarikaya@tga-nord.de', telefon: '+49 40 998877-3', roleIds: ['rol-3'], notiz: 'Ansprechpartner Lüftung' },
      { id: 'con-4', projectId: 'prj-1', anrede: 'Frau', vorname: 'Marlene', nachname: 'Hoffstedt', firma: 'Ingenieurbüro Hoffstedt', email: 'm.hoffstedt@ib-hoffstedt.de', telefon: '+49 40 556677-1', roleIds: ['rol-4'], notiz: '' },
      { id: 'con-5', projectId: 'prj-1', anrede: 'Herr', vorname: 'Robert', nachname: 'Lindqvist', firma: 'Nordpark Immobilien GmbH', email: 'r.lindqvist@nordpark-immobilien.de', telefon: '+49 40 224466-0', roleIds: ['rol-5'], notiz: 'Freigaben nur donnerstags' },
      { id: 'con-6', projectId: 'prj-2', anrede: 'Frau', vorname: 'Yuki', nachname: 'Tanaka', firma: 'Sander & Partner', email: 'y.tanaka@sander-partner.de', telefon: '+49 40 123456-22', roleIds: ['rol-7', 'rol-8'], notiz: '' },
      { id: 'con-7', projectId: 'prj-2', anrede: 'Herr', vorname: 'Dietmar', nachname: 'Krause', firma: 'Stadt Lüneburg, GM', email: 'd.krause@lueneburg.de', telefon: '+49 4131 309-0', roleIds: ['rol-9'], notiz: '' },
    ],
    documents: [
      { id: 'doc-1', projectId: 'prj-1', kind: 'paket', parentId: null, nummer: 'PP-AF-01', titel: 'Ausführungsplanung Regelgeschosse', index: 'C', massstab: '', gewerk: 'Architektur', status: 'im_umlauf', verantwortlichContactId: 'con-1', bemerkung: 'Grundrisse 1.–4. OG' },
      { id: 'doc-2', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', nummer: 'A-GR-102', titel: 'Grundriss 2. Obergeschoss', index: 'C', massstab: '1:50', gewerk: 'Architektur', status: 'im_umlauf', verantwortlichContactId: 'con-1', bemerkung: '' },
      { id: 'doc-3', projectId: 'prj-1', kind: 'plan', parentId: 'doc-1', nummer: 'A-GR-103', titel: 'Grundriss 3. Obergeschoss', index: 'B', massstab: '1:50', gewerk: 'Architektur', status: 'entwurf', verantwortlichContactId: 'con-1', bemerkung: '' },
      { id: 'doc-4', projectId: 'prj-1', kind: 'plan', parentId: null, nummer: 'A-SC-201', titel: 'Schnitt A–A', index: 'A', massstab: '1:50', gewerk: 'Architektur', status: 'geprueft', verantwortlichContactId: 'con-1', bemerkung: '' },
      { id: 'doc-5', projectId: 'prj-1', kind: 'verzeichnis', parentId: null, nummer: 'PV-TGA', titel: 'Planverzeichnis TGA gesamt', index: '04', massstab: '', gewerk: 'TGA', status: 'im_umlauf', verantwortlichContactId: 'con-3', bemerkung: 'Fortschreibung monatlich' },
      { id: 'doc-6', projectId: 'prj-1', kind: 'plan', parentId: 'doc-5', nummer: 'T-LU-410', titel: 'Lüftung 4. OG', index: 'A', massstab: '1:50', gewerk: 'TGA', status: 'entwurf', verantwortlichContactId: 'con-3', bemerkung: '' },
      { id: 'doc-7', projectId: 'prj-2', kind: 'paket', parentId: null, nummer: 'PP-BA2', titel: 'Bauabschnitt 2 – Fassade', index: 'A', massstab: '', gewerk: 'Architektur', status: 'entwurf', verantwortlichContactId: 'con-6', bemerkung: '' },
      { id: 'doc-8', projectId: 'prj-2', kind: 'plan', parentId: 'doc-7', nummer: 'A-FA-011', titel: 'Fassadenschnitt Nord', index: 'A', massstab: '1:20', gewerk: 'Architektur', status: 'im_umlauf', verantwortlichContactId: 'con-6', bemerkung: '' },
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
        bemerkung: '',
        steps: [
          { id: 'rs-1', name: 'Planerstellung', typ: 'task', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -18), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-2', name: 'Interne Prüfung', typ: 'review', roleName: 'Projektleitung', contactId: 'con-2', fristTage: 3, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -14), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-3', name: 'Versand an Fachplaner', typ: 'versand', roleName: 'Projektsteuerung', contactId: 'con-2', fristTage: 1, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -13), status: 'erledigt', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-4', name: 'Fachplanerprüfung', typ: 'review', roleName: 'Fachplanung TGA', contactId: 'con-3', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: false, bemerkung: 'Rückmeldung angemahnt.', letzteErinnerung: null },
          { id: 'rs-5', name: 'Einarbeitung Kommentare', typ: 'task', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 5, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-6', name: 'Freigabe Bauherr', typ: 'freigabe', roleName: 'Bauherr', contactId: 'con-5', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-7', name: 'Verteilung an Ausführende', typ: 'versand', roleName: 'Projektsteuerung', contactId: 'con-2', fristTage: 2, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
        ],
      },
      {
        id: 'run-2',
        projectId: 'prj-1',
        documentId: 'doc-5',
        templateId: 'tpl-werkplanung',
        templateName: 'Standard-Planlauf Werk- & Montageplanung',
        name: 'Prüflauf Planverzeichnis TGA',
        start: addDays(heute, -6),
        status: 'laufend',
        bemerkung: 'Fristen gegenüber Standard verkürzt (Terminverzug Rohbau).',
        steps: [
          { id: 'rs-8', name: 'Einreichung Werkplanung', typ: 'task', roleName: 'Ausführende Firma', contactId: 'con-3', fristTage: 7, sollDatum: null, sollManuell: false, istDatum: addDays(heute, -1), status: 'erledigt', abweichung: true, bemerkung: 'Frist von 14 auf 7 Tage verkürzt.', letzteErinnerung: null },
          { id: 'rs-9', name: 'Prüfung Objektplanung', typ: 'review', roleName: 'Objektplanung', contactId: 'con-1', fristTage: 4, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: true, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-10', name: 'Prüfung Fachplanung', typ: 'review', roleName: 'Fachplanung TGA', contactId: 'con-3', fristTage: 7, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-11', name: 'Freigabevermerk', typ: 'freigabe', roleName: 'Projektleitung', contactId: 'con-2', fristTage: 3, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-12', name: 'Rückgabe an Firma', typ: 'versand', roleName: 'Projektsteuerung', contactId: 'con-2', fristTage: 1, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
        ],
      },
      {
        id: 'run-3',
        projectId: 'prj-2',
        documentId: 'doc-8',
        templateId: 'tpl-ausfuehrungsplanung',
        templateName: 'Standard-Planlauf Ausführungsplanung',
        name: 'Planlauf Fassadenschnitt Nord',
        start: addDays(heute, -3),
        status: 'laufend',
        bemerkung: '',
        steps: [
          { id: 'rs-13', name: 'Planerstellung', typ: 'task', roleName: 'Objektplanung', contactId: 'con-6', fristTage: 10, sollDatum: null, sollManuell: false, istDatum: null, status: 'laufend', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-14', name: 'Interne Prüfung', typ: 'review', roleName: 'Projektleitung', contactId: 'con-6', fristTage: 3, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: false, bemerkung: '', letzteErinnerung: null },
          { id: 'rs-15', name: 'Freigabe Bauherr', typ: 'freigabe', roleName: 'Bauherr', contactId: 'con-7', fristTage: 14, sollDatum: null, sollManuell: false, istDatum: null, status: 'offen', abweichung: true, bemerkung: 'Verlängerte Freigabefrist laut Vertrag.', letzteErinnerung: null },
        ],
      },
    ],
  };

  // Soll-Termine einmalig durchrechnen
  data.runs = data.runs.map((run) => {
    const project = data.projects.find((p) => p.id === run.projectId)!;
    return {
      ...run,
      steps: recalcSollDaten(run.steps, run.start, project.settings.fristenInArbeitstagen, project.settings.feiertage),
    };
  });

  return data;
}

export { t as demoDatum };
