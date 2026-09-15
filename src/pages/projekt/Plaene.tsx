/**
 * Pläne und Planverzeichnisse eines Projekts – jeweils mit ihrem Planlauf.
 *
 * Einen eigenen Planlauf haben Planverzeichnisse und Einzelpläne; Pläne eines
 * Verzeichnisses laufen in dessen Lauf mit. Planpakete sind reine
 * Ordnungsmerkmale und werden auf einer eigenen Seite gepflegt.
 */
import { Fragment, useMemo, useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  fortschritt,
  istAktiv,
  lfdNummern,
  kontaktFuerRolleUndGewerk,
  stepsAusTemplate,
} from '../../domain/engine';
import { formatDate, relativeLabel, tageLabel, today } from '../../lib/dates';
import {
  DOCUMENT_KIND_LABEL,
  GEWERKE,
  INDEX_LABEL,
  NUMMER_LABEL,
  PLANUNGSPHASEN,
  type DocumentKind,
  type ID,
  type PlanDocument,
  type PlanRun,
  type ProcessTemplateStep,
  type Project,
} from '../../domain/types';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { AmpelPunkt, DocKindIcon } from '../../components/common';
import { SchrittListe } from '../Workflows';
import { PlaeneImport } from './PlaeneImport';
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Progress,
  Search,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';
import { ErledigtButton, useSchrittStatus } from '../../components/SchrittStatus';

type Filter = 'alle' | 'plan' | 'verzeichnis';

/** Sonderwert der Auswahlfelder: Eintrag direkt neu anlegen. */
const NEU = '__neu__';
type SortFeld = 'nummer' | 'titel' | 'gewerk' | 'planungsphase' | 'eingangSoll' | 'stand';

/** Ableitbarer Bearbeitungsstand eines Eintrags. */
interface Stand {
  text: string;
  ton: '' | 'green' | 'orange' | 'red' | 'blue';
  rang: number;
  run?: PlanRun;
}

export function standFuer(doc: PlanDocument, runs: PlanRun[]): Stand {
  if (doc.kind === 'paket') return { text: 'Planpaket', ton: '', rang: 5 };
  // Pläne eines Verzeichnisses laufen im Lauf des Verzeichnisses mit.
  if (doc.parentId) return { text: 'im Planlauf des Verzeichnisses', ton: '', rang: 4 };
  const eigene = runs.filter((r) => r.documentId === doc.id);
  const aktiv = eigene.find(istAktiv);
  if (aktiv) {
    const step = aktuellerSchritt(aktiv);
    return { text: step ? step.name : 'Im Planlauf', ton: 'blue', rang: 1, run: aktiv };
  }
  const fertig = eigene.find((r) => r.status === 'abgeschlossen');
  if (fertig) return { text: 'Abgeschlossen', ton: 'green', rang: 2, run: fertig };
  const abgebrochen = eigene.find((r) => r.status === 'abgebrochen');
  if (abgebrochen) return { text: 'Abgebrochen', ton: 'red', rang: 3, run: abgebrochen };
  return { text: 'Kein Planlauf', ton: 'orange', rang: 0 };
}

export function Plaene({ project, oeffneLauf }: { project: Project; oeffneLauf: (runId: ID) => void }) {
  const { data } = useStore();
  const { setzeStatus, nachweisDialog } = useSchrittStatus();
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [sortFeld, setSortFeld] = useState<SortFeld>('nummer');
  const [absteigend, setAbsteigend] = useState(false);
  const [dialog, setDialog] = useState<{ doc?: PlanDocument } | null>(null);
  const [importOffen, setImportOffen] = useState(false);

  const runs = useMemo(() => data.runs.filter((r) => r.projectId === project.id), [data.runs, project.id]);
  // Planpakete werden auf einer eigenen Seite gepflegt
  const alle = data.documents.filter((d) => d.projectId === project.id && d.kind !== 'paket');
  const pakete = data.documents.filter((d) => d.projectId === project.id && d.kind === 'paket');

  const passt = (d: PlanDocument) =>
    (filter === 'alle' || d.kind === filter) &&
    [d.nummer, d.titel, d.gewerk, d.index, d.planungsphase].join(' ').toLowerCase().includes(suche.toLowerCase());

  const gefiltert = alle.filter(passt);

  const sortiere = (liste: PlanDocument[]) => {
    const richtung = absteigend ? -1 : 1;
    return [...liste].sort((a, b) => {
      if (sortFeld === 'stand') return (standFuer(a, runs).rang - standFuer(b, runs).rang) * richtung;
      if (sortFeld === 'eingangSoll')
        return (a.eingangSoll ?? '9999').localeCompare(b.eingangSoll ?? '9999') * richtung;
      return a[sortFeld].localeCompare(b[sortFeld], 'de', { numeric: true }) * richtung;
    });
  };

  // Gliederung: Planpaket › Planverzeichnis › Plan. Einträge ohne Paket
  // stehen gebündelt am Ende.
  type Zeile = { doc: PlanDocument; tiefe: number };

  /** Das für die Gliederung maßgebliche Paket – bei Plänen das des Verzeichnisses. */
  const paketVon = (d: PlanDocument): ID | null => {
    if (d.kind === 'plan' && d.parentId) {
      const eltern = alle.find((x) => x.id === d.parentId);
      if (eltern) return eltern.paketId;
    }
    return d.paketId;
  };

  const eintraegeFuer = (paketId: ID | null): Zeile[] => {
    const zeilen: Zeile[] = [];
    const sammle = (doc: PlanDocument, tiefe: number) => {
      zeilen.push({ doc, tiefe });
      sortiere(gefiltert.filter((d) => d.parentId === doc.id)).forEach((k) => sammle(k, tiefe + 1));
    };
    sortiere(
      gefiltert.filter(
        (d) =>
          paketVon(d) === paketId && (!d.parentId || !gefiltert.some((p) => p.id === d.parentId)),
      ),
    ).forEach((d) => sammle(d, 0));
    return zeilen;
  };

  const gruppen: { paket: PlanDocument | null; zeilen: Zeile[] }[] = [
    ...pakete.map((paket) => ({ paket, zeilen: eintraegeFuer(paket.id) })),
    { paket: null, zeilen: eintraegeFuer(null) },
  ].filter((g) => g.zeilen.length > 0 || g.paket !== null);

  const nummern = lfdNummern(data.documents.filter((d) => d.projectId === project.id));

  const sortieren = (feld: SortFeld) => {
    if (feld === sortFeld) setAbsteigend((a) => !a);
    else {
      setSortFeld(feld);
      setAbsteigend(false);
    }
  };

  const Kopf = ({ feld, children, klasse = '' }: { feld: SortFeld; children: React.ReactNode; klasse?: string }) => (
    <th className={klasse}>
      <button type="button" className="sort-btn" onClick={() => sortieren(feld)}>
        {children}
        <span className={`sort-pfeil ${sortFeld === feld ? 'aktiv' : ''}`}>
          {sortFeld === feld ? (absteigend ? '▾' : '▴') : '▴'}
        </span>
      </button>
    </th>
  );

  const ohneLauf = alle.filter((d) => standFuer(d, runs).rang === 0).length;

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div className="row wrap">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'alle', label: `Alle (${alle.length})` },
              { value: 'plan', label: 'Pläne' },
              { value: 'verzeichnis', label: 'Verzeichnisse' },
            ]}
          />
          <Search value={suche} onChange={setSuche} placeholder="Nummer, Titel, Gewerk …" />
        </div>
        <div className="row">
          <button type="button" className="btn btn-outline" onClick={() => setImportOffen(true)}>
            <Icon name="importieren" size={14} /> Excel-Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
            <Icon name="plus" size={14} /> Neuer Eintrag
          </button>
        </div>
      </div>

      <Card>
        <CardHeader
          titel="Planliste"
          sub={
            ohneLauf > 0
              ? `${ohneLauf} Eintrag/Einträge ohne Planlauf · Spaltenüberschrift klicken zum Sortieren`
              : 'Gegliedert nach Planpaketen · Spaltenüberschrift klicken zum Sortieren'
          }
        />
        {gefiltert.length === 0 ? (
          <EmptyState
            icon="plan"
            titel="Noch keine Einträge"
            text="Mit einem neuen Eintrag wird zugleich sein Planlauf gestartet."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
                <Icon name="plus" size={14} /> Neuer Eintrag
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 58 }}>Nr.</th>
                  <Kopf feld="nummer">Bezeichnung / Titel</Kopf>
                  <Kopf feld="gewerk" klasse="col-optional">Gewerk</Kopf>
                  <Kopf feld="stand">Aktueller Schritt</Kopf>
                  <th className="col-optional" style={{ width: 140 }}>Fortschritt</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {gruppen.map((gruppe) => (
                  <Fragment key={gruppe.paket?.id ?? 'ohne-paket'}>
                    <tr className="gruppe-zeile">
                      <td colSpan={6}>
                        <span className="row" style={{ gap: 9 }}>
                          {gruppe.paket ? <DocKindIcon kind="paket" /> : null}
                          <span>
                            <strong>{gruppe.paket ? gruppe.paket.titel : 'Ohne Planpaket'}</strong>
                            <span className="small tertiary"> · {gruppe.zeilen.length} Einträge</span>
                          </span>
                        </span>
                      </td>
                    </tr>

                    {gruppe.zeilen.map(({ doc, tiefe }) => {
                      const stand = standFuer(doc, runs);
                      const run = stand.run;
                      const step = run && istAktiv(run) ? aktuellerSchritt(run) : undefined;
                      const ampel = step
                        ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage)
                        : 'neutral';
                      // Abgebrochene Vorgänger – etwa nach einer neuen Ausgabe –
                      // bleiben als graue Zeile sichtbar und behalten ihre Nummer.
                      const abgebrochene = runs.filter(
                        (r) => r.documentId === doc.id && r.status === 'abgebrochen' && r.id !== run?.id,
                      );
                      const einzug = 14 + tiefe * 20;
                      return (
                        <Fragment key={doc.id}>
                          <tr
                            className={`clickable ${run?.status === 'abgebrochen' ? 'zeile-verworfen' : ''}`}
                            onClick={() => (run ? oeffneLauf(run.id) : setDialog({ doc }))}
                          >
                            <td className="num tertiary">{nummern.get(doc.id) ?? '–'}</td>
                            <td style={{ paddingLeft: einzug }}>
                              <span className="row" style={{ gap: 9 }}>
                                <DocKindIcon kind={doc.kind} />
                                <span style={{ minWidth: 0 }}>
                                  <span className="num">
                                    {doc.nummer}
                                    {doc.index ? ` · ${INDEX_LABEL[doc.kind]} ${doc.index}` : ''}
                                  </span>
                                  <div>
                                    <strong>{doc.titel}</strong>
                                  </div>
                                </span>
                              </span>
                            </td>
                            <td className="small muted col-optional">{doc.gewerk || '–'}</td>
                            <td>
                              {run && istAktiv(run) ? (
                                <>
                                  <span className="row" style={{ gap: 7 }}>
                                    <AmpelPunkt ampel={ampel} />
                                    <strong className="small">{stand.text}</strong>
                                  </span>
                                  <span className="tertiary small">
                                    {step?.roleName ? `${step.roleName} · ` : ''}
                                    {relativeLabel(step?.sollDatum ?? null)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Badge ton={stand.ton}>{stand.text}</Badge>
                                  {run?.status === 'abgebrochen' && run.abbruchGrund ? (
                                    <div className="small tertiary truncate">{run.abbruchGrund}</div>
                                  ) : null}
                                </>
                              )}
                            </td>
                            <td className="col-optional">
                              {run ? (
                                <span className="row" style={{ gap: 8 }}>
                                  <Progress
                                    wert={fortschritt(run)}
                                    ton={ampel === 'ueberfaellig' ? 'red' : fortschritt(run) === 100 ? 'green' : ''}
                                  />
                                  <span className="small tertiary">{fortschritt(run)} %</span>
                                </span>
                              ) : (
                                <span className="small tertiary">–</span>
                              )}
                            </td>
                            <td className="actions">
                              {run && step ? (
                                <ErledigtButton
                                  run={run}
                                  step={step}
                                  onErledigen={(r, sch) => setzeStatus(r, sch, 'erledigt')}
                                />
                              ) : null}
                              <button
                                type="button"
                                className="btn-icon"
                                aria-label="Eintrag bearbeiten"
                                title="Stammdaten bearbeiten"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDialog({ doc });
                                }}
                              >
                                <Icon name="bearbeiten" size={15} />
                              </button>
                            </td>
                          </tr>

                          {abgebrochene.map((alt) => (
                            <tr
                              key={alt.id}
                              className="clickable zeile-verworfen"
                              onClick={() => oeffneLauf(alt.id)}
                            >
                              <td className="num tertiary">{nummern.get(doc.id) ?? '–'}</td>
                              <td style={{ paddingLeft: einzug }}>
                                <span className="row" style={{ gap: 9 }}>
                                  <DocKindIcon kind={doc.kind} />
                                  <span style={{ minWidth: 0 }}>
                                    <span className="num">
                                      {doc.nummer}
                                      {alt.index ? ` · ${INDEX_LABEL[doc.kind]} ${alt.index}` : ''}
                                    </span>
                                    <div className="small">{doc.titel}</div>
                                  </span>
                                </span>
                              </td>
                              <td className="small col-optional">{doc.gewerk || '–'}</td>
                              <td>
                                <Badge>Abgebrochen</Badge>
                                <div className="small tertiary truncate">
                                  {alt.abbruchDatum ? `${formatDate(alt.abbruchDatum)} · ` : ''}
                                  {alt.abbruchArt === 'neuer_index' && alt.abbruchNeuerIndex
                                    ? `ersetzt durch ${INDEX_LABEL[doc.kind]} ${alt.abbruchNeuerIndex}`
                                    : (alt.abbruchGrund || 'ersatzlos')}
                                </div>
                              </td>
                              <td className="col-optional">
                                <span className="small tertiary">–</span>
                              </td>
                              <td className="actions" />
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {nachweisDialog}

      {importOffen ? <PlaeneImport project={project} onClose={() => setImportOffen(false)} /> : null}

      {dialog ? (
        <PlanDialog
          project={project}
          doc={dialog.doc}
          onClose={() => setDialog(null)}
          onLaufGestartet={oeffneLauf}
        />
      ) : null}
    </div>
  );
}

/**
 * Anlage und Pflege eines Eintrags. Beim Anlegen – und bei Einträgen ohne
 * Planlauf – gehört die Workflow dazu, sodass Eintrag und Planlauf
 * gemeinsam entstehen.
 */
function PlanDialog({
  project,
  doc,
  onClose,
  onLaufGestartet,
}: {
  project: Project;
  doc?: PlanDocument;
  onClose: () => void;
  onLaufGestartet: (runId: ID) => void;
}) {
  const { data, addDocument, updateDocument, deleteDocument, addRun } = useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);

  const vorlagen = data.templates.filter((t) => t.projectId === null || t.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);
  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const vorhandenerLauf = doc ? data.runs.find((r) => r.documentId === doc.id) : undefined;

  const [form, setForm] = useState({
    kind: doc?.kind ?? ('plan' as DocumentKind),
    parentId: doc?.parentId ?? (null as ID | null),
    paketId: doc?.paketId ?? (null as ID | null),
    nummer: doc?.nummer ?? '',
    titel: doc?.titel ?? '',
    index: doc?.index ?? '',
    gewerk: doc?.gewerk ?? '',
    planungsphase: doc?.planungsphase ?? '',
    eingangSoll: doc?.eingangSoll ?? '',
    datum: doc?.datum ?? '',
    bemerkung: doc?.bemerkung ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Pläne eines Verzeichnisses laufen im Planlauf des Verzeichnisses mit
  const untergeordnet = form.kind === 'plan' && form.parentId !== null;
  const braucheLauf = !vorhandenerLauf && !untergeordnet;

  /** Planverzeichnisse des Projekts – mögliche „Eltern“ eines Plans. */
  const moeglicheEltern = data.documents.filter(
    (d) => d.projectId === project.id && d.id !== doc?.id && d.kind === 'verzeichnis',
  );
  const pakete = data.documents.filter((d) => d.projectId === project.id && d.kind === 'paket');

  // Pläne eines Verzeichnisses gehören automatisch zu dessen Planpaket
  const elternPaket = moeglicheEltern.find((d) => d.id === form.parentId)?.paketId ?? null;
  const wirksamesPaket = untergeordnet ? elternPaket : form.paketId;

  /** Anlage eines Planverzeichnisses bzw. Planpakets direkt aus der Auswahl. */
  const [schnell, setSchnell] = useState<'verzeichnis' | 'paket' | null>(null);

  const schnellAnlegen = (art: 'verzeichnis' | 'paket', titel: string, nummer: string) => {
    const id = addDocument({
      projectId: project.id,
      kind: art,
      parentId: null,
      paketId: art === 'verzeichnis' ? form.paketId : null,
      nummer,
      titel,
      index: '',
      gewerk: form.gewerk,
      planungsphase: art === 'verzeichnis' ? form.planungsphase : '',
      eingangSoll: null,
      datum: null,
      bemerkung: '',
    });
    if (art === 'verzeichnis') set('parentId', id);
    else set('paketId', id);
    toast(
      art === 'verzeichnis'
        ? 'Planverzeichnis angelegt – der Planlauf lässt sich über den Eintrag starten.'
        : 'Planpaket angelegt.',
    );
  };

  /** Bearbeitbare Kopie der Vorlagenschritte. */
  const kopie = (id: string): ProcessTemplateStep[] => {
    const t = vorlagen.find((v) => v.id === id);
    if (!t) return [];
    const idMap = new Map(t.steps.map((s) => [s.id, newId('ts')]));
    return t.steps.map((s) => ({
      ...s,
      id: idMap.get(s.id)!,
      antworten: s.antworten.map((a) => ({
        ...a,
        id: newId('ant'),
        ziel: a.ziel === 'ende' || a.ziel === null ? a.ziel : (idMap.get(a.ziel) ?? null),
      })),
    }));
  };

  const [templateId, setTemplateId] = useState(vorlagen[0]?.id ?? '');
  const [steps, setSteps] = useState<ProcessTemplateStep[]>(() => kopie(vorlagen[0]?.id ?? ''));
  const [start, setStart] = useState(today());

  const vorlageWechseln = (id: string) => {
    setTemplateId(id);
    setSteps(kopie(id));
  };

  /**
   * Besetzung einer Rolle: Bei Rollen mit Gewerkbezug zählt die Zuordnung für
   * das Gewerk des Eintrags, sonst die gewerkübergreifende Zuordnung.
   */
  const kontaktFuerRolle = (roleName: string): ID | null =>
    kontaktFuerRolleUndGewerk(kontakte, rollen, roleName, form.gewerk);

  const speichern = () => {
    if (!form.titel.trim()) {
      toast('Bitte einen Titel angeben.');
      return;
    }
    const werte = {
      ...form,
      eingangSoll: form.eingangSoll || null,
      datum: form.kind === 'verzeichnis' ? form.datum || null : null,
      parentId: form.kind === 'plan' ? form.parentId : null,
      paketId: wirksamesPaket,
    };

    // Einträge ohne eigenen Planlauf – etwa Pläne eines Verzeichnisses –
    // werden nur gespeichert.
    if (!braucheLauf) {
      if (doc) {
        updateDocument(doc.id, werte);
        toast('Eintrag aktualisiert.');
      } else {
        addDocument({ ...werte, projectId: project.id });
        toast(
          untergeordnet
            ? 'Plan angelegt – er läuft im Planlauf des Verzeichnisses mit.'
            : 'Eintrag angelegt.',
        );
      }
      onClose();
      return;
    }

    if (steps.length === 0 || steps.some((s) => !s.name.trim())) {
      toast('Bitte jeden Schritt der Workflow benennen.');
      return;
    }

    const documentId = doc ? doc.id : addDocument({ ...werte, projectId: project.id });
    if (doc) updateDocument(doc.id, werte);

    const template = vorlagen.find((t) => t.id === templateId);
    const runSteps = stepsAusTemplate(
      { id: templateId, projectId: null, name: '', beschreibung: '', herkunft: 'manuell', steps },
      kontaktFuerRolle,
      () => newId('rs'),
    );
    const original = template?.steps ?? [];
    const markiert = runSteps.map((s, i) => {
      const vorlage = original[i];
      const abweichend =
        !vorlage ||
        original.length !== runSteps.length ||
        vorlage.name !== s.name ||
        vorlage.fristTage !== s.fristTage ||
        vorlage.roleName !== s.roleName ||
        vorlage.typ !== s.typ;
      return abweichend ? { ...s, abweichung: true } : s;
    });

    const runId = addRun({
      projectId: project.id,
      documentId,
      templateId: template?.id ?? null,
      templateName: template?.name ?? 'Individuelle Kette',
      name: `Planlauf ${form.nummer || form.titel}${
        form.index ? ` ${INDEX_LABEL[form.kind]} ${form.index}` : ''
      }`,
      index: form.index,
      start,
      status: 'laufend',
      abbruchGrund: null,
      abbruchDatum: null,
      abbruchArt: null,
      abbruchNeuerIndex: null,
      steps: markiert,
      bemerkung: '',
    });

    const ohneKontakt = markiert.filter((s) => !s.contactId).length;
    toast(
      ohneKontakt > 0
        ? `Eintrag angelegt und Planlauf gestartet – ${ohneKontakt} Schritt(e) noch ohne Person.`
        : 'Eintrag angelegt und Planlauf gestartet.',
    );
    onClose();
    onLaufGestartet(runId);
  };

  const dauer = steps.reduce((s, x) => s + x.fristTage, 0);

  return (
    <>
      <Modal
        titel={doc ? `${DOCUMENT_KIND_LABEL[doc.kind]} bearbeiten` : 'Neuer Eintrag'}
        sub={doc ? doc.nummer : 'Stammdaten und Workflow – der Planlauf startet mit dem Eintrag'}
        wide={braucheLauf}
        onClose={onClose}
        footer={
          <>
            {doc ? (
              <button type="button" className="btn btn-danger" onClick={() => setLoeschen(true)}>
                <Icon name="loeschen" size={14} /> Löschen
              </button>
            ) : null}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            <button type="button" className="btn btn-primary" onClick={speichern}>
              {braucheLauf ? 'Anlegen und Planlauf starten' : 'Speichern'}
            </button>
          </>
        }
      >
        <div className="stack" style={{ gap: 16 }}>
          <div className="form-grid">
            <Field label="Art">
              <Select
                value={form.kind}
                onChange={(v) => {
                  set('kind', v as DocumentKind);
                  if (v !== 'plan') set('parentId', null);
                }}
                options={[
                  { value: 'plan', label: DOCUMENT_KIND_LABEL.plan },
                  { value: 'verzeichnis', label: DOCUMENT_KIND_LABEL.verzeichnis },
                ]}
              />
            </Field>
            {form.kind === 'plan' ? (
              <Field
                label="Planverzeichnis"
                hint="Pläne eines Verzeichnisses laufen in dessen Planlauf mit; ohne Verzeichnis erhält der Plan einen eigenen Lauf."
              >
                <Select
                  value={form.parentId ?? ''}
                  onChange={(v) => (v === NEU ? setSchnell('verzeichnis') : set('parentId', v || null))}
                  placeholder="– Einzelplan –"
                  options={[
                    ...moeglicheEltern.map((d) => ({ value: d.id, label: `${d.nummer} · ${d.titel}` })),
                    { value: NEU, label: '+ Neues Planverzeichnis anlegen …' },
                  ]}
                />
              </Field>
            ) : null}
            <Field
              label="Planpaket"
              hint={
                untergeordnet
                  ? 'Ergibt sich aus dem Planverzeichnis'
                  : 'Ordnungsmerkmal ohne Einfluss auf den Planlauf'
              }
            >
              {untergeordnet ? (
                <input
                  className="input"
                  readOnly
                  value={pakete.find((p) => p.id === elternPaket)?.titel ?? 'keinem Paket zugeordnet'}
                />
              ) : (
                <Select
                  value={form.paketId ?? ''}
                  onChange={(v) => (v === NEU ? setSchnell('paket') : set('paketId', v || null))}
                  placeholder="– keinem Paket zugeordnet –"
                  options={[
                    ...pakete.map((d) => ({ value: d.id, label: d.titel || d.nummer })),
                    { value: NEU, label: '+ Neues Planpaket anlegen …' },
                  ]}
                />
              )}
            </Field>
            <Field label={NUMMER_LABEL[form.kind]}>
              <TextInput
                value={form.nummer}
                onChange={(v) => set('nummer', v)}
                placeholder={form.kind === 'plan' ? 'NK-KIB-EÜ-001' : 'Bezeichnung'}
              />
            </Field>
            <Field label={INDEX_LABEL[form.kind]} hint="bleibt leer, solange nichts vergeben ist">
              <TextInput value={form.index} onChange={(v) => set('index', v)} placeholder="ohne" />
            </Field>
            <Field label="Titel" full>
              <TextInput value={form.titel} onChange={(v) => set('titel', v)} />
            </Field>
            <Field label="Gewerk" hint="Auswahl oder freie Eingabe">
              <input
                className="input"
                list="gewerke-liste"
                value={form.gewerk}
                onChange={(e) => set('gewerk', e.target.value)}
                placeholder="KIB, VA, OLA …"
              />
              <datalist id="gewerke-liste">
                {GEWERKE.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label="Planungsphase" hint="Auswahl oder freie Eingabe">
              <input
                className="input"
                list="phasen-liste"
                value={form.planungsphase}
                onChange={(e) => set('planungsphase', e.target.value)}
                placeholder="Ausführungsplanung …"
              />
              <datalist id="phasen-liste">
                {PLANUNGSPHASEN.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Eingang Soll" hint="Soll-Termin des ersten Prozessschritts">
              <TextInput value={form.eingangSoll} onChange={(v) => set('eingangSoll', v)} type="date" />
            </Field>
            {form.kind === 'verzeichnis' ? (
              <Field label="Datum der Ausgabe">
                <TextInput value={form.datum} onChange={(v) => set('datum', v)} type="date" />
              </Field>
            ) : null}
            <Field label="Bemerkung" full>
              <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
            </Field>
          </div>

          {braucheLauf ? (
            <>
              <div className="divider" />
              <div className="form-grid">
                <Field label="Workflow" full hint={vorlagen.find((t) => t.id === templateId)?.beschreibung}>
                  <Select
                    value={templateId}
                    onChange={vorlageWechseln}
                    options={vorlagen.map((t) => ({ value: t.id, label: `${t.name} (${t.steps.length} Schritte)` }))}
                  />
                </Field>
                <Field label="Start des Planlaufs">
                  <TextInput value={start} onChange={setStart} type="date" />
                </Field>
              </div>

              <div>
                <div className="row-between wrap" style={{ marginBottom: 8 }}>
                  <h3>Schritte dieses Planlaufs</h3>
                  <span className="small tertiary">
                    {steps.length} Schritte · {tageLabel(dauer)}
                    {project.settings.fristenInArbeitstagen ? ' (Arbeitstage)' : ''}
                  </span>
                </div>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  Schritte lassen sich hier hinzufügen, ändern oder entfernen. Die Workflow selbst bleibt davon
                  unberührt.
                </p>
                <SchrittListe steps={steps} setSteps={setSteps} rollen={rollen.map((r) => r.name)} />
              </div>
            </>
          ) : untergeordnet ? (
            <Callout icon="i">
              Pläne eines Planverzeichnisses erhalten keinen eigenen Planlauf – maßgeblich ist der Lauf des
              Verzeichnisses.
            </Callout>
          ) : (
            <Callout icon="i">
              Für diesen Eintrag läuft bereits der Planlauf „{vorhandenerLauf?.name}“. Die Schritte werden dort
              gepflegt.
            </Callout>
          )}
        </div>
      </Modal>

      {schnell ? (
        <SchnellDialog
          art={schnell}
          onClose={() => setSchnell(null)}
          onAnlegen={(titel, nummer) => schnellAnlegen(schnell, titel, nummer)}
        />
      ) : null}

      {loeschen && doc ? (
        <ConfirmDialog
          titel="Eintrag löschen?"
          text={`„${doc.titel}“ wird mit seinem Planlauf gelöscht. Zugeordnete Pläne bleiben erhalten.`}
          onConfirm={() => {
            deleteDocument(doc.id);
            toast('Eintrag gelöscht.');
            onClose();
          }}
          onClose={() => setLoeschen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Kleiner Dialog, um aus der Auswahl heraus ein Planverzeichnis oder ein
 * Planpaket anzulegen, ohne den Eintrag zu verlassen.
 */
function SchnellDialog({
  art,
  onClose,
  onAnlegen,
}: {
  art: 'verzeichnis' | 'paket';
  onClose: () => void;
  onAnlegen: (titel: string, nummer: string) => void;
}) {
  const toast = useToast();
  const [titel, setTitel] = useState('');
  const [nummer, setNummer] = useState('');

  const speichern = () => {
    if (!titel.trim()) {
      toast('Bitte eine Bezeichnung angeben.');
      return;
    }
    onAnlegen(titel.trim(), nummer.trim());
    onClose();
  };

  return (
    <Modal
      titel={art === 'verzeichnis' ? 'Neues Planverzeichnis' : 'Neues Planpaket'}
      sub={
        art === 'verzeichnis'
          ? 'Wird angelegt und dem Plan übergeordnet; der Planlauf lässt sich später starten.'
          : 'Wird angelegt und dem Eintrag zugeordnet.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={speichern}>
            Anlegen
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={art === 'verzeichnis' ? NUMMER_LABEL.verzeichnis : NUMMER_LABEL.paket} full>
          <TextInput
            value={titel}
            onChange={setTitel}
            autoFocus
            placeholder={art === 'verzeichnis' ? 'Planverzeichnis Überbau' : 'Eisenbahnüberführung Nordkanal'}
            onKeyDown={(e) => e.key === 'Enter' && speichern()}
          />
        </Field>
        <Field label="Kurzzeichen" full hint="optional">
          <TextInput
            value={nummer}
            onChange={setNummer}
            placeholder={art === 'verzeichnis' ? 'NK-KIB-PV-001' : 'PP-Nordkanal'}
          />
        </Field>
      </div>
    </Modal>
  );
}
