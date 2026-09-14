/**
 * Lokale Persistenz im Browser (localStorage). Die Schnittstelle ist absichtlich
 * schmal gehalten, damit sie später gegen eine echte Datenbank-API getauscht
 * werden kann, ohne die Oberfläche anzufassen.
 */
import {
  DATEN_VERSION,
  EIGENE_ROLLE,
  GEWERKE,
  STAMMDATEN_VERSION,
  type AppData,
  type ProcessTemplate,
  type Role,
  type StandardRolle,
  type StepType,
} from '../domain/types';
import { STANDARD_ROLLEN, STANDARD_TEMPLATES, seedData } from '../domain/seed';

/** Frühere Bezeichnung der eigenen Rolle. */
const ALTE_EIGENE_ROLLE = 'PLM';

/** Hebt einen Rollennamen auf die aktuelle Bezeichnung. */
const rollenName = (name: string) => (name === ALTE_EIGENE_ROLLE ? EIGENE_ROLLE : name);

/**
 * Frühere Fassungen führten je Funktion eine Liste von Gewerken bzw. nur
 * „individuell“/„übergreifend“. Daraus wird die Liste der Gewerke, aus der
 * anschließend je Gewerk eine eigene Funktion entsteht.
 */
function gewerkeVon(rolle: { gewerke?: string[]; gewerk?: string | null; gewerkBezug?: string; name: string }): string[] {
  if (rolle.gewerk !== undefined) return rolle.gewerk === null ? [] : [rolle.gewerk];
  if (Array.isArray(rolle.gewerke)) return rolle.gewerke;
  if (rolle.gewerkBezug === 'uebergreifend') return [];
  if (rolle.gewerkBezug === 'individuell') return [...GEWERKE];
  const standard = STANDARD_ROLLEN.filter((s) => s.name === rollenName(rolle.name));
  if (standard.length === 0) return [...GEWERKE];
  return standard.every((s) => s.gewerk === null) ? [] : standard.map((s) => s.gewerk!).filter(Boolean);
}

/** Kennung der aus einer früheren Funktion je Gewerk entstehenden Funktion. */
const gewerkId = (id: string, gewerk: string | null) => (gewerk ? `${id}~${gewerk}` : id);

/**
 * Teilt eine Funktion mit mehreren Gewerken in je eine Funktion pro Gewerk auf
 * („Fachplaner OLA“ und „Fachplaner KIB“ sind verschiedene Funktionen).
 */
function rollenAufteilen<T extends { id: string; name: string }>(rollen: T[]): (Omit<T, 'gewerke'> & { gewerk: string | null })[] {
  return rollen.flatMap((r) => {
    const { gewerke: _alt, ...rest } = r as T & { gewerke?: string[] };
    const gewerke = gewerkeVon(r as never);
    if (gewerke.length === 0) return [{ ...rest, name: rollenName(r.name), gewerk: null } as never];
    return gewerke.map(
      (g) => ({ ...rest, id: gewerkId(r.id, g), name: rollenName(r.name), gewerk: g }) as never,
    );
  });
}

const KEY = 'planlauf-management.data.v1';

export function ladeDaten(): AppData {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return seedData();
    const daten = JSON.parse(roh) as AppData;
    if (!daten || !Array.isArray(daten.projects)) return seedData();
    return stammdatenAktualisieren(migriere(daten));
  } catch {
    return seedData();
  }
}

const neueId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Übernimmt neue mitgelieferte Stammdaten in einen bestehenden Bestand:
 * Funktionen und Standard-Workflows werden auf den aktuellen Stand
 * gebracht und fehlende Rollen in jedes Projekt ergänzt. Eigene Rollen,
 * eigene Ketten, Projektvarianten und laufende Planläufe bleiben erhalten.
 */
function stammdatenAktualisieren(daten: AppData): AppData {
  if ((daten.stammdatenVersion ?? 0) >= STAMMDATEN_VERSION) return daten;

  const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  /** Funktionen sind gleich, wenn Bezeichnung und Gewerk übereinstimmen. */
  const gleicheFunktion = (a: { name: string; gewerk: string | null }, b: { name: string; gewerk: string | null }) =>
    gleich(a.name, b.name) && (a.gewerk ?? '') === (b.gewerk ?? '');

  // Funktionen: mitgelieferte übernehmen, eigene behalten
  const eigeneStandards = (daten.standardRollen ?? []).filter(
    (r) => !STANDARD_ROLLEN.some((s) => gleicheFunktion(s, r)),
  );
  const standardRollen: StandardRolle[] = [
    ...STANDARD_ROLLEN.map((r) => ({ ...r })),
    ...eigeneStandards,
  ];

  // Standard-Workflows ersetzen, eigene Ketten und Projektvarianten behalten
  const eigeneKetten = (daten.templates ?? []).filter(
    (t) => t.projectId !== null || t.herkunft !== 'standard',
  );
  const templates: ProcessTemplate[] = [...STANDARD_TEMPLATES.map((t) => ({ ...t })), ...eigeneKetten];

  // Fehlende Rollen in jedes Projekt ergänzen
  const roles: Role[] = [...(daten.roles ?? [])];
  for (const projekt of daten.projects) {
    for (const standard of STANDARD_ROLLEN) {
      const vorhanden = roles.some((r) => r.projectId === projekt.id && gleicheFunktion(r, standard));
      if (vorhanden) continue;
      roles.push({
        id: neueId('rol'),
        projectId: projekt.id,
        name: standard.name,
        kuerzel: standard.kuerzel,
        farbe: standard.farbe,
        beschreibung: standard.beschreibung,
        gewerk: standard.gewerk,
      });
    }
  }

  return { ...daten, stammdatenVersion: STAMMDATEN_VERSION, standardRollen, templates, roles };
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
    stammdatenVersion: daten.stammdatenVersion ?? 0,
    bearbeiter: daten.bearbeiter
      ? { ...daten.bearbeiter, rolle: rollenName(daten.bearbeiter.rolle) }
      : { name: 'PLM', rolle: EIGENE_ROLLE, email: '' },
    standardRollen:
      daten.standardRollen && daten.standardRollen.length > 0
        ? rollenAufteilen(daten.standardRollen)
        : STANDARD_ROLLEN.map((r) => ({ ...r })),
    projects: (daten.projects ?? []).map((p) => ({ ...p, markiert: p.markiert ?? true })),
    roles: rollenAufteilen(daten.roles ?? []),
    contacts: (daten.contacts ?? []).map((c) => {
      const alt = c as unknown as { roleIds?: string[] };
      const alteRollen = daten.roles ?? [];
      const zuordnungen = c.zuordnungen ?? (alt.roleIds ?? []).map((roleId) => ({ roleId, gewerk: null }));
      return {
        ...c,
        anschrift: c.anschrift ?? '',
        // Zuordnungen zeigen jetzt auf die Funktion des jeweiligen Gewerks
        zuordnungen: zuordnungen.flatMap((z) => {
          const alteRolle = alteRollen.find((r) => r.id === z.roleId);
          if (!alteRolle) return [z];
          const gewerke = gewerkeVon(alteRolle as never);
          if (gewerke.length === 0) return [{ roleId: z.roleId, gewerk: null }];
          // Ohne angegebenes Gewerk galt die Besetzung für alle Gewerke der Funktion
          const ziele = z.gewerk ? [z.gewerk] : gewerke;
          return ziele
            .filter((g) => gewerke.includes(g))
            .map((g) => ({ roleId: gewerkId(z.roleId, g), gewerk: g }));
        }),
      };
    }),
    documents: (daten.documents ?? []).map((d) => {
      const alt = d as unknown as Record<string, unknown>;
      // Planpakete haben keinen eigenen Planlauf mehr. Pakete, an denen ein
      // Lauf hängt, werden daher zu Planverzeichnissen – der Lauf und die
      // untergeordneten Pläne bleiben so erhalten.
      const mitLauf = (x: { id: string; kind: string }) =>
        x.kind === 'paket' && (daten.runs ?? []).some((r) => r.documentId === x.id);
      const eltern = (daten.documents ?? []).find((x) => x.id === d.parentId);
      // Ein übergeordnetes Paket ohne Lauf wird zum reinen Ordnungsmerkmal.
      const paketEltern = Boolean(eltern && eltern.kind === 'paket' && !mitLauf(eltern));
      return {
        id: d.id,
        projectId: d.projectId,
        kind: mitLauf(d) ? ('verzeichnis' as const) : d.kind,
        parentId: paketEltern ? null : (d.parentId ?? null),
        paketId: (alt.paketId as string) ?? (paketEltern ? eltern!.id : null),
        nummer: d.nummer,
        titel: d.titel,
        index: d.index ?? '',
        gewerk: d.gewerk ?? '',
        planungsphase: (alt.planungsphase as string) ?? '',
        eingangSoll: (alt.eingangSoll as string) ?? null,
        datum: (alt.datum as string) ?? null,
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
      index: r.index ?? (daten.documents ?? []).find((d) => d.id === r.documentId)?.index ?? '',
      status: r.status === 'abgeschlossen' || r.status === 'abgebrochen' ? r.status : 'laufend',
      abbruchGrund: r.abbruchGrund ?? null,
      abbruchDatum: r.abbruchDatum ?? null,
      abbruchArt: r.abbruchArt ?? (r.status === 'abgebrochen' ? 'ersatzlos' : null),
      abbruchNeuerIndex: r.abbruchNeuerIndex ?? null,
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
