/**
 * Fachliches Datenmodell des Planlauf-Managements.
 *
 * Die Struktur ist bewusst so geschnitten, dass sie später 1:1 auf
 * relationale Tabellen abgebildet werden kann (jede Entität hat eine
 * eigene ID, Referenzen laufen ausschließlich über IDs).
 */

export type ID = string;

/** ISO-Datum ohne Zeitanteil, z.B. "2026-03-14". */
export type ISODate = string;

/* ------------------------------------------------------------------ */
/* Projekt                                                             */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'aktiv' | 'pausiert' | 'abgeschlossen';

export interface Project {
  id: ID;
  nummer: string;
  name: string;
  bauherr: string;
  ort: string;
  status: ProjectStatus;
  start: ISODate;
  ende: ISODate | null;
  beschreibung: string;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  /** Vorlaufzeit in Tagen, ab der eine Frist als "fällig" gemeldet wird. */
  erinnerungVorlaufTage: number;
  /** Fristen in Arbeitstagen (Mo–Fr) statt Kalendertagen rechnen. */
  fristenInArbeitstagen: boolean;
  /** Projektbezogene Feiertage, die bei Arbeitstagen übersprungen werden. */
  feiertage: ISODate[];
  /** E-Mail-Vorlagen für Erinnerungen, Freigaben, Rückfragen … */
  emailTemplates: EmailTemplate[];
  /** Absender, der in der Vorlage als {{absender}} eingesetzt wird. */
  absenderName: string;
  absenderEmail: string;
}

export interface EmailTemplate {
  id: ID;
  name: string;
  /** Anlass, für den die Vorlage vorgeschlagen wird. */
  anlass: EmailAnlass;
  betreff: string;
  text: string;
}

export type EmailAnlass = 'erinnerung' | 'ueberfaellig' | 'freigabe' | 'uebergabe' | 'allgemein';

export const EMAIL_ANLASS_LABEL: Record<EmailAnlass, string> = {
  erinnerung: 'Erinnerung (Frist läuft)',
  ueberfaellig: 'Mahnung (überfällig)',
  freigabe: 'Freigabe erteilt',
  uebergabe: 'Übergabe / Versand',
  allgemein: 'Allgemein',
};

/* ------------------------------------------------------------------ */
/* Adressbuch & Rollen                                                 */
/* ------------------------------------------------------------------ */

/** Frei definierbare Projektrolle, z.B. "Objektplanung" oder "Prüfstatiker". */
export interface Role {
  id: ID;
  projectId: ID;
  name: string;
  kuerzel: string;
  farbe: string;
  beschreibung: string;
}

export interface Contact {
  id: ID;
  projectId: ID;
  anrede: string;
  vorname: string;
  nachname: string;
  firma: string;
  email: string;
  telefon: string;
  /** Zugeordnete Rollen (n:m über Rollen-IDs). */
  roleIds: ID[];
  notiz: string;
}

/* ------------------------------------------------------------------ */
/* Pläne, Planpakete, Planverzeichnisse                                */
/* ------------------------------------------------------------------ */

export type DocumentKind = 'plan' | 'paket' | 'verzeichnis';

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  plan: 'Plan',
  paket: 'Planpaket',
  verzeichnis: 'Planverzeichnis',
};

export type DocumentStatus = 'entwurf' | 'im_umlauf' | 'geprueft' | 'freigegeben' | 'archiviert';

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  entwurf: 'Entwurf',
  im_umlauf: 'Im Umlauf',
  geprueft: 'Geprüft',
  freigegeben: 'Freigegeben',
  archiviert: 'Archiviert',
};

export interface PlanDocument {
  id: ID;
  projectId: ID;
  kind: DocumentKind;
  /** Übergeordnetes Paket / Verzeichnis (Hierarchie innerhalb eines Projekts). */
  parentId: ID | null;
  nummer: string;
  titel: string;
  index: string;
  massstab: string;
  gewerk: string;
  status: DocumentStatus;
  /** Verantwortliche Person aus dem Adressbuch. */
  verantwortlichContactId: ID | null;
  bemerkung: string;
}

/* ------------------------------------------------------------------ */
/* Prozessketten (Vorlagen, u.a. aus BPMN 2.0 importiert)              */
/* ------------------------------------------------------------------ */

export type StepType = 'task' | 'review' | 'freigabe' | 'versand' | 'gateway';

export const STEP_TYPE_LABEL: Record<StepType, string> = {
  task: 'Aufgabe',
  review: 'Prüfung',
  freigabe: 'Freigabe',
  versand: 'Versand',
  gateway: 'Entscheidung',
};

export interface ProcessTemplate {
  id: ID;
  /** null = globale Standardkette, sonst projektspezifische Variante. */
  projectId: ID | null;
  name: string;
  beschreibung: string;
  /** Herkunft: manuell gepflegt oder aus einer BPMN-2.0-Datei importiert. */
  herkunft: 'standard' | 'bpmn' | 'manuell';
  bpmnDateiname?: string;
  steps: ProcessTemplateStep[];
}

export interface ProcessTemplateStep {
  id: ID;
  name: string;
  typ: StepType;
  /** Rolle, die den Schritt ausführt – wird beim Start auf Personen gemappt. */
  roleName: string;
  /** Frist in Tagen ab Ende des Vorgängerschritts. */
  fristTage: number;
  beschreibung: string;
}

/* ------------------------------------------------------------------ */
/* Planlauf = laufende Instanz einer Prozesskette                      */
/* ------------------------------------------------------------------ */

export type RunStatus = 'geplant' | 'laufend' | 'abgeschlossen' | 'abgebrochen';

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  geplant: 'Geplant',
  laufend: 'Laufend',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
};

export interface PlanRun {
  id: ID;
  projectId: ID;
  documentId: ID;
  /** Vorlage, aus der der Lauf erzeugt wurde (nur Herkunftsnachweis). */
  templateId: ID | null;
  templateName: string;
  name: string;
  start: ISODate;
  status: RunStatus;
  /** Kopie der Schritte – individuelle Abweichungen ändern nur diese Instanz. */
  steps: RunStep[];
  bemerkung: string;
}

export type StepStatus = 'offen' | 'laufend' | 'erledigt' | 'uebersprungen';

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  offen: 'Offen',
  laufend: 'Laufend',
  erledigt: 'Erledigt',
  uebersprungen: 'Übersprungen',
};

export interface RunStep {
  id: ID;
  name: string;
  typ: StepType;
  roleName: string;
  /** Konkret zuständige Person aus dem Adressbuch. */
  contactId: ID | null;
  fristTage: number;
  /** Berechnetes Soll-Datum; manuell überschreibbar (dann Ketten-Basis). */
  sollDatum: ISODate | null;
  /** true, sobald der Nutzer das Soll-Datum manuell gesetzt hat. */
  sollManuell: boolean;
  istDatum: ISODate | null;
  status: StepStatus;
  /** Kennzeichnet vom Standard abweichende Schritte (individuelle Anpassung). */
  abweichung: boolean;
  bemerkung: string;
  /** Zeitpunkt der letzten versendeten Erinnerung (ISO-Timestamp). */
  letzteErinnerung: string | null;
}

/* ------------------------------------------------------------------ */
/* Gesamter lokaler Datenbestand                                       */
/* ------------------------------------------------------------------ */

export interface AppData {
  version: number;
  projects: Project[];
  roles: Role[];
  contacts: Contact[];
  documents: PlanDocument[];
  templates: ProcessTemplate[];
  runs: PlanRun[];
}
