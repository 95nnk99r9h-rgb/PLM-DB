/**
 * Import von BPMN-2.0-Diagrammen als Prozessketten-Vorlage.
 *
 * Es wird bewusst nur der fachlich relevante Teil ausgewertet: Aktivitäten
 * und Gateways werden entlang der Sequenzflüsse vom Start-Event aus in eine
 * lineare Schrittfolge gebracht. Lanes liefern die Rolle, die Dauer wird –
 * sofern vorhanden – aus ISO-8601-Dauern (z.B. P5D) oder aus einer
 * Extension-Property "frist"/"fristTage" gelesen.
 */
import type { ProcessTemplate, ProcessTemplateStep, StepType } from './types';

export interface BpmnImportResult {
  name: string;
  steps: ProcessTemplateStep[];
  warnungen: string[];
}

const AKTIVITAETEN = [
  'task',
  'userTask',
  'manualTask',
  'serviceTask',
  'sendTask',
  'receiveTask',
  'scriptTask',
  'businessRuleTask',
  'callActivity',
  'subProcess',
];

const GATEWAYS = ['exclusiveGateway', 'inclusiveGateway', 'parallelGateway', 'eventBasedGateway'];

function local(el: Element): string {
  return el.localName ?? el.nodeName.replace(/^.*:/, '');
}

function typFuer(tag: string, name: string): StepType {
  if (GATEWAYS.includes(tag)) return 'gateway';
  if (tag === 'sendTask') return 'versand';
  const n = name.toLowerCase();
  if (/(freigab|genehmig|approv)/.test(n)) return 'freigabe';
  if (/(prüf|pruef|review|kontroll)/.test(n)) return 'review';
  if (/(versand|versende|verteil|übergab|uebergab|verschick)/.test(n)) return 'versand';
  return 'task';
}

/** Liest "P5D", "P1W", "PT48H" als Tage. */
function dauerAusISO(text: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/.exec(text.trim());
  if (!m) return null;
  const wochen = Number(m[1] ?? 0);
  const tage = Number(m[2] ?? 0);
  const stunden = Number(m[3] ?? 0);
  const summe = wochen * 7 + tage + Math.ceil(stunden / 24);
  return summe > 0 ? summe : null;
}

function fristAusElement(el: Element): number | null {
  // <bpmn:documentation> oder Extension-Properties mit "frist"
  for (const attr of ['frist', 'fristTage', 'dauer', 'duration']) {
    const v = el.getAttribute(attr);
    if (v && !Number.isNaN(Number(v))) return Number(v);
  }
  const props = Array.from(el.getElementsByTagName('*')).filter((e) =>
    ['property', 'field', 'formalExpression', 'timeDuration', 'documentation'].includes(local(e)),
  );
  for (const p of props) {
    const name = (p.getAttribute('name') ?? '').toLowerCase();
    const value = p.getAttribute('value') ?? p.textContent ?? '';
    if (name.includes('frist') || name.includes('dauer') || name.includes('duration')) {
      if (!Number.isNaN(Number(value))) return Number(value);
      const iso = dauerAusISO(value);
      if (iso) return iso;
    }
    const iso = dauerAusISO(value);
    if (iso) return iso;
    const treffer = /frist\s*[:=]\s*(\d+)/i.exec(value);
    if (treffer) return Number(treffer[1]);
  }
  return null;
}

/** Ordnet jeder Element-ID die Lane (= Rolle) zu. */
function laneZuordnung(doc: Document): Map<string, string> {
  const map = new Map<string, string>();
  for (const lane of Array.from(doc.getElementsByTagName('*')).filter((e) => local(e) === 'lane')) {
    const rolle = lane.getAttribute('name') ?? '';
    if (!rolle) continue;
    for (const ref of Array.from(lane.children).filter((c) => local(c) === 'flowNodeRef')) {
      const id = (ref.textContent ?? '').trim();
      if (id) map.set(id, rolle);
    }
  }
  return map;
}

export function parseBpmn(xml: string, dateiname = ''): BpmnImportResult {
  const warnungen: string[] = [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Die Datei konnte nicht als XML gelesen werden.');
  }

  const alle = Array.from(doc.getElementsByTagName('*'));
  const process = alle.find((e) => local(e) === 'process');
  if (!process) throw new Error('Kein <process>-Element gefunden – ist das eine BPMN-2.0-Datei?');

  const knoten = new Map<string, Element>();
  for (const el of alle) {
    const id = el.getAttribute('id');
    if (!id) continue;
    const tag = local(el);
    if (AKTIVITAETEN.includes(tag) || GATEWAYS.includes(tag) || tag.endsWith('Event')) {
      knoten.set(id, el);
    }
  }

  const flows = alle
    .filter((e) => local(e) === 'sequenceFlow')
    .map((e) => ({ from: e.getAttribute('sourceRef') ?? '', to: e.getAttribute('targetRef') ?? '' }))
    .filter((f) => f.from && f.to);

  const nachfolger = new Map<string, string[]>();
  const hatVorgaenger = new Set<string>();
  for (const f of flows) {
    nachfolger.set(f.from, [...(nachfolger.get(f.from) ?? []), f.to]);
    hatVorgaenger.add(f.to);
  }

  const startId =
    alle.find((e) => local(e) === 'startEvent')?.getAttribute('id') ??
    Array.from(knoten.keys()).find((id) => !hatVorgaenger.has(id));

  const lanes = laneZuordnung(doc);
  const reihenfolge: string[] = [];
  const besucht = new Set<string>();

  // Tiefensuche entlang der Sequenzflüsse; Verzweigungen werden in
  // Reihenfolge der Flüsse hintereinandergehängt (lineare Kette).
  const lauf = (id: string) => {
    if (!id || besucht.has(id)) return;
    besucht.add(id);
    reihenfolge.push(id);
    for (const next of nachfolger.get(id) ?? []) lauf(next);
  };
  if (startId) lauf(startId);

  // Knoten ohne Anbindung an den Start trotzdem übernehmen
  for (const id of knoten.keys()) {
    if (!besucht.has(id)) {
      reihenfolge.push(id);
      warnungen.push(`Knoten "${knoten.get(id)?.getAttribute('name') ?? id}" hängt nicht am Startereignis.`);
    }
  }

  const steps: ProcessTemplateStep[] = [];
  for (const id of reihenfolge) {
    const el = knoten.get(id);
    if (!el) continue;
    const tag = local(el);
    if (tag.endsWith('Event')) continue; // Start/Ende sind keine Fristenschritte
    const name = el.getAttribute('name')?.trim() || (GATEWAYS.includes(tag) ? 'Entscheidung' : tag);
    const frist = fristAusElement(el);
    if (frist === null && !GATEWAYS.includes(tag)) {
      warnungen.push(`Für "${name}" war keine Frist hinterlegt – 5 Tage angenommen.`);
    }
    steps.push({
      id: `bpmn-${id}`,
      name,
      typ: typFuer(tag, name),
      roleName: lanes.get(id) ?? '',
      fristTage: frist ?? (GATEWAYS.includes(tag) ? 0 : 5),
      beschreibung: '',
    });
  }

  if (steps.length === 0) throw new Error('Es wurden keine Aufgaben im Diagramm gefunden.');

  const name =
    process.getAttribute('name')?.trim() ||
    alle.find((e) => local(e) === 'collaboration')?.getAttribute('name')?.trim() ||
    dateiname.replace(/\.(bpmn|xml)$/i, '') ||
    'Importierte Prozesskette';

  return { name, steps, warnungen };
}

/** Erzeugt aus einem Importergebnis eine Vorlage. */
export function templateAusImport(
  result: BpmnImportResult,
  id: string,
  projectId: string | null,
  dateiname: string,
): ProcessTemplate {
  return {
    id,
    projectId,
    name: result.name,
    beschreibung: `Aus BPMN-2.0-Datei importiert (${result.steps.length} Schritte).`,
    herkunft: 'bpmn',
    bpmnDateiname: dateiname,
    steps: result.steps,
  };
}
