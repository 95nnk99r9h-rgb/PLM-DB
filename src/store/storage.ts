/**
 * Lokale Persistenz im Browser (localStorage). Die Schnittstelle ist absichtlich
 * schmal gehalten, damit sie später gegen eine echte Datenbank-API getauscht
 * werden kann, ohne die Oberfläche anzufassen.
 */
import { DATEN_VERSION, EIGENE_ROLLE, type AppData, type StepType } from '../domain/types';
import { STANDARD_ROLLEN, seedData } from '../domain/seed';

/** Frühere Bezeichnung der eigenen Rolle. */
const ALTE_EIGENE_ROLLE = 'PLM';

/** Hebt einen Rollennamen auf die aktuelle Bezeichnung. */
const rollenName = (name: string) => (name === ALTE_EIGENE_ROLLE ? EIGENE_ROLLE : name);

const KEY = 'planlauf-management.data.v1';

export function ladeDaten(): AppData {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return seedData();
    const daten = JSON.parse(roh) as AppData;
    if (!daten || !Array.isArray(daten.projects)) return seedData();
    return migriere(daten);
  } catch {
    return seedData();
  }
}

/** Ordnet die früheren Schrittarten den drei aktuellen Arten zu. */
function migriereTyp(alt: string): StepType {
  if (alt === 'gateway' || alt === 'entscheidung') return 'entscheidung';
  if (alt === 'versand' || alt === 'sonstiges') return 'sonstiges';
  return 'aufgabe';
}

/**
 * Hebt einen älteren Bestand auf die aktuelle Fassung. Fehlende Felder werden
 * mit sinnvollen Standardwerten ergänzt, damit vorhandene Eingaben erhalten
 * bleiben.
 */
function migriere(daten: AppData): AppData {
  if (daten.version === DATEN_VERSION) return daten;

  const alsAntworten = (typ: StepType, vorhanden: unknown) => {
    if (Array.isArray(vorhanden) && vorhanden.length > 0) return vorhanden as never;
    if (typ !== 'entscheidung') return [];
    return [
      { id: `ant-${Math.random().toString(36).slice(2, 9)}`, text: 'Ja', ziel: null },
      { id: `ant-${Math.random().toString(36).slice(2, 9)}`, text: 'Nein', ziel: null },
    ] as never;
  };

  return {
    version: DATEN_VERSION,
    bearbeiter: daten.bearbeiter
      ? { ...daten.bearbeiter, rolle: rollenName(daten.bearbeiter.rolle) }
      : { name: 'PLM', rolle: EIGENE_ROLLE, email: '' },
    standardRollen:
      daten.standardRollen && daten.standardRollen.length > 0
        ? daten.standardRollen
        : STANDARD_ROLLEN.map((r) => ({ ...r })),
    projects: (daten.projects ?? []).map((p) => ({ ...p, markiert: p.markiert ?? true })),
    roles: (daten.roles ?? []).map((r) => ({
      ...r,
      name: rollenName(r.name),
      // Übergreifend besetzt sind nur die projektweiten Rollen
      gewerkBezug:
        r.gewerkBezug ??
        (STANDARD_ROLLEN.find((s) => s.name === rollenName(r.name))?.gewerkBezug ?? 'individuell'),
    })),
    contacts: (daten.contacts ?? []).map((c) => {
      const alt = c as unknown as { roleIds?: string[] };
      return {
        ...c,
        anschrift: c.anschrift ?? '',
        // Frühere Rollenzuordnungen galten für alle Gewerke
        zuordnungen:
          c.zuordnungen ?? (alt.roleIds ?? []).map((roleId) => ({ roleId, gewerk: null })),
      };
    }),
    documents: (daten.documents ?? []).map((d) => {
      const alt = d as unknown as Record<string, unknown>;
      return {
        id: d.id,
        projectId: d.projectId,
        kind: d.kind,
        nummer: d.nummer,
        titel: d.titel,
        index: d.index ?? '',
        gewerk: d.gewerk ?? '',
        planungsphase: (alt.planungsphase as string) ?? '',
        eingangSoll: (alt.eingangSoll as string) ?? null,
        bemerkung: d.bemerkung ?? '',
      };
    }),
    templates: (daten.templates ?? []).map((t) => ({
      ...t,
      herkunft: t.herkunft === 'standard' ? 'standard' : 'manuell',
      steps: (t.steps ?? []).map((s) => {
        const typ = migriereTyp(s.typ as unknown as string);
        return {
          ...s,
          typ,
          roleName: rollenName(s.roleName),
          antworten: alsAntworten(typ, s.antworten),
          naechster: s.naechster ?? null,
          nachweis: s.nachweis ?? 'keine',
        };
      }),
    })),
    runs: (daten.runs ?? []).map((r) => ({
      ...r,
      status: r.status === 'abgeschlossen' || r.status === 'abgebrochen' ? r.status : 'laufend',
      abbruchGrund: r.abbruchGrund ?? null,
      abbruchDatum: r.abbruchDatum ?? null,
      steps: (r.steps ?? []).map((s) => {
        const typ = migriereTyp(s.typ as unknown as string);
        return {
          ...s,
          typ,
          roleName: rollenName(s.roleName),
          antworten: alsAntworten(typ, s.antworten),
          naechster: s.naechster ?? null,
          gewaehlteAntwortId: s.gewaehlteAntwortId ?? null,
          durchlauf: s.durchlauf ?? 1,
          nachweis: s.nachweis ?? 'keine',
          nachweisNummer: s.nachweisNummer ?? null,
        };
      }),
    })),
  };
}

export function speichereDaten(daten: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(daten));
  } catch (err) {
    console.warn('Daten konnten nicht lokal gespeichert werden:', err);
  }
}

export function loescheDaten(): void {
  localStorage.removeItem(KEY);
}

export function exportiereDaten(daten: AppData): void {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planlauf-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
