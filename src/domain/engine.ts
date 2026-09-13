/**
 * Planlauf-Logik: Soll-Termine aus Fristen rechnen, Ampelstatus bestimmen
 * und offene Fristen für Erinnerungen einsammeln.
 */
import { addDays, diffDays, today } from '../lib/dates';
import type {
  AppData,
  ISODate,
  PlanRun,
  Project,
  ProcessTemplate,
  RunStep,
  ID,
} from './types';

export type Ampel = 'erledigt' | 'ueberfaellig' | 'faellig' | 'geplant' | 'neutral';

export const AMPEL_LABEL: Record<Ampel, string> = {
  erledigt: 'Erledigt',
  ueberfaellig: 'Überfällig',
  faellig: 'Fällig',
  geplant: 'Im Plan',
  neutral: 'Ohne Termin',
};

/**
 * Rechnet die Soll-Termine einer Schrittkette neu durch.
 *
 * Regel: Soll = Soll des Vorgängers + Frist des Schritts. Ein manuell
 * gesetztes Soll-Datum bleibt erhalten und wird zur neuen Basis für alle
 * folgenden Schritte (so lassen sich individuelle Abweichungen abbilden).
 */
export function recalcSollDaten(
  steps: RunStep[],
  start: ISODate,
  arbeitstage: boolean,
  feiertage: ISODate[],
): RunStep[] {
  let basis = start;
  return steps.map((step) => {
    if (step.sollManuell && step.sollDatum) {
      basis = step.sollDatum;
      return step;
    }
    const soll = addDays(basis, step.fristTage, arbeitstage, feiertage);
    basis = soll;
    return { ...step, sollDatum: soll };
  });
}

/** Rechnet einen kompletten Lauf mit den Projekteinstellungen durch. */
export function recalcRun(run: PlanRun, project: Project | undefined): PlanRun {
  const arbeitstage = project?.settings.fristenInArbeitstagen ?? true;
  const feiertage = project?.settings.feiertage ?? [];
  return { ...run, steps: recalcSollDaten(run.steps, run.start, arbeitstage, feiertage) };
}

export function ampelFuerSchritt(step: RunStep, vorlaufTage: number): Ampel {
  if (step.status === 'erledigt' || step.status === 'uebersprungen') return 'erledigt';
  if (!step.sollDatum) return 'neutral';
  const delta = diffDays(today(), step.sollDatum);
  if (delta < 0) return 'ueberfaellig';
  if (delta <= vorlaufTage) return 'faellig';
  return 'geplant';
}

/** Der erste nicht erledigte Schritt – der Lauf "hängt" hier. */
export function aktuellerSchritt(run: PlanRun): RunStep | undefined {
  return run.steps.find((s) => s.status !== 'erledigt' && s.status !== 'uebersprungen');
}

export function fortschritt(run: PlanRun): number {
  if (run.steps.length === 0) return 0;
  const fertig = run.steps.filter((s) => s.status === 'erledigt' || s.status === 'uebersprungen').length;
  return Math.round((fertig / run.steps.length) * 100);
}

/** Verzug des Laufs in Tagen (>0 = überfällig), bezogen auf den aktuellen Schritt. */
export function verzugTage(run: PlanRun): number {
  const step = aktuellerSchritt(run);
  if (!step?.sollDatum) return 0;
  const delta = diffDays(today(), step.sollDatum);
  return delta < 0 ? Math.abs(delta) : 0;
}

export interface FristEintrag {
  run: PlanRun;
  step: RunStep;
  project: Project;
  ampel: Ampel;
  tageBisSoll: number;
}

/**
 * Alle offenen Schritte über alle (oder ein) Projekt(e), sortiert nach
 * Dringlichkeit – Datenbasis für Dashboard und Erinnerungen.
 */
export function offeneFristen(data: AppData, projectId?: ID): FristEintrag[] {
  const eintraege: FristEintrag[] = [];
  for (const run of data.runs) {
    if (projectId && run.projectId !== projectId) continue;
    if (run.status === 'abgeschlossen' || run.status === 'abgebrochen') continue;
    const project = data.projects.find((p) => p.id === run.projectId);
    if (!project) continue;
    const vorlauf = project.settings.erinnerungVorlaufTage;
    for (const step of run.steps) {
      if (step.status === 'erledigt' || step.status === 'uebersprungen') continue;
      const ampel = ampelFuerSchritt(step, vorlauf);
      if (ampel !== 'ueberfaellig' && ampel !== 'faellig' && ampel !== 'geplant') continue;
      eintraege.push({
        run,
        step,
        project,
        ampel,
        tageBisSoll: step.sollDatum ? diffDays(today(), step.sollDatum) : 9999,
      });
    }
  }
  return eintraege.sort((a, b) => a.tageBisSoll - b.tageBisSoll);
}

/** Erzeugt aus einer Vorlage die Schritte eines neuen Laufs. */
export function stepsAusTemplate(
  template: ProcessTemplate,
  contactFuerRolle: (roleName: string) => ID | null,
  newId: () => string,
): RunStep[] {
  return template.steps.map((s) => ({
    id: newId(),
    name: s.name,
    typ: s.typ,
    roleName: s.roleName,
    contactId: contactFuerRolle(s.roleName),
    fristTage: s.fristTage,
    sollDatum: null,
    sollManuell: false,
    istDatum: null,
    status: 'offen' as const,
    abweichung: false,
    bemerkung: s.beschreibung,
    letzteErinnerung: null,
  }));
}

/** Gesamtdauer einer Vorlage in Tagen. */
export function templateDauer(template: ProcessTemplate): number {
  return template.steps.reduce((sum, s) => sum + s.fristTage, 0);
}
