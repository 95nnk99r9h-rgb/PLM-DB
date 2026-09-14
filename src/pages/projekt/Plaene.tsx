/** Pläne, Planpakete und Planverzeichnisse eines Projekts (hierarchisch). */
import { useMemo, useState } from 'react';
import { aktuellerSchritt, fortschritt, istAktiv } from '../../domain/engine';
import { formatDate } from '../../lib/dates';
import {
  DOCUMENT_KIND_LABEL,
  GEWERKE,
  PLANUNGSPHASEN,
  type DocumentKind,
  type ID,
  type PlanDocument,
  type PlanRun,
  type Project,
} from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { DocKindIcon } from '../../components/common';
import {
  Badge,
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

type Filter = 'alle' | DocumentKind;
type SortFeld = 'nummer' | 'titel' | 'gewerk' | 'planungsphase' | 'eingangSoll' | 'stand';

/** Ableitbarer Bearbeitungsstand eines Eintrags. */
interface Stand {
  text: string;
  ton: '' | 'green' | 'orange' | 'red' | 'blue';
  rang: number;
  run?: PlanRun;
}

function standFuer(doc: PlanDocument, runs: PlanRun[]): Stand {
  const eigene = runs.filter((r) => r.documentId === doc.id);
  const aktiv = eigene.find(istAktiv);
  if (aktiv) {
    const step = aktuellerSchritt(aktiv);
    return { text: step ? `Im Planlauf: ${step.name}` : 'Im Planlauf', ton: 'blue', rang: 1, run: aktiv };
  }
  const fertig = eigene.find((r) => r.status === 'abgeschlossen');
  if (fertig) return { text: 'Planlauf abgeschlossen', ton: 'green', rang: 2, run: fertig };
  const abgebrochen = eigene.find((r) => r.status === 'abgebrochen');
  if (abgebrochen) return { text: 'Planlauf abgebrochen', ton: 'red', rang: 3, run: abgebrochen };
  return { text: 'Ausstehend – kein Planlauf', ton: 'orange', rang: 0 };
}

export function Plaene({
  project,
  onPlanlaufStarten,
}: {
  project: Project;
  onPlanlaufStarten: (doc: PlanDocument) => void;
}) {
  const { data } = useStore();
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Filter>('alle');
  const [sortFeld, setSortFeld] = useState<SortFeld>('nummer');
  const [absteigend, setAbsteigend] = useState(false);
  const [dialog, setDialog] = useState<{ doc?: PlanDocument } | null>(null);

  const runs = useMemo(() => data.runs.filter((r) => r.projectId === project.id), [data.runs, project.id]);
  const alle = data.documents.filter((d) => d.projectId === project.id);

  const passt = (d: PlanDocument) =>
    (filter === 'alle' || d.kind === filter) &&
    [d.nummer, d.titel, d.gewerk, d.index, d.planungsphase].join(' ').toLowerCase().includes(suche.toLowerCase());

  const gefiltert = alle.filter(passt);

  const sortiere = (liste: PlanDocument[]) => {
    const richtung = absteigend ? -1 : 1;
    return [...liste].sort((a, b) => {
      if (sortFeld === 'stand') {
        return (standFuer(a, runs).rang - standFuer(b, runs).rang) * richtung;
      }
      if (sortFeld === 'eingangSoll') {
        return ((a.eingangSoll ?? '9999').localeCompare(b.eingangSoll ?? '9999')) * richtung;
      }
      return a[sortFeld].localeCompare(b[sortFeld], 'de', { numeric: true }) * richtung;
    });
  };

  // Hierarchie erhalten: je Ebene sortieren
  const zeilen: { doc: PlanDocument; tiefe: number }[] = [];
  const sammle = (doc: PlanDocument, tiefe: number) => {
    zeilen.push({ doc, tiefe });
    sortiere(gefiltert.filter((d) => d.parentId === doc.id)).forEach((k) => sammle(k, tiefe + 1));
  };
  sortiere(gefiltert.filter((d) => !d.parentId || !gefiltert.some((p) => p.id === d.parentId))).forEach((d) =>
    sammle(d, 0),
  );

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

  const ausstehend = alle.filter((d) => standFuer(d, runs).rang === 0).length;

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div className="row wrap">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'alle', label: `Alle (${alle.length})` },
              { value: 'paket', label: 'Pakete' },
              { value: 'plan', label: 'Pläne' },
              { value: 'verzeichnis', label: 'Verzeichnisse' },
            ]}
          />
          <Search value={suche} onChange={setSuche} placeholder="Nummer, Titel, Gewerk …" />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
          <Icon name="plus" size={14} /> Neuer Eintrag
        </button>
      </div>

      <Card>
        <CardHeader
          titel="Planbestand"
          sub={
            ausstehend > 0
              ? `${ausstehend} Eintrag/Einträge ohne Planlauf – Spaltenüberschrift klicken zum Sortieren`
              : 'Alle Einträge sind in einem Planlauf – Spaltenüberschrift klicken zum Sortieren'
          }
        />
        {zeilen.length === 0 ? (
          <EmptyState
            icon="plan"
            titel="Noch keine Pläne erfasst"
            text="Legen Sie Planpakete, Einzelpläne oder Planverzeichnisse an."
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
                  <Kopf feld="nummer">Nummer / Titel</Kopf>
                  <Kopf feld="gewerk" klasse="col-optional">Gewerk</Kopf>
                  <Kopf feld="planungsphase" klasse="col-optional">Phase</Kopf>
                  <th className="col-optional">Index</th>
                  <Kopf feld="eingangSoll" klasse="col-optional">Eingang Soll</Kopf>
                  <Kopf feld="stand">Stand</Kopf>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {zeilen.map(({ doc, tiefe }) => {
                  const stand = standFuer(doc, runs);
                  return (
                    <tr key={doc.id} className="clickable" onClick={() => setDialog({ doc })}>
                      <td style={{ paddingLeft: 14 + tiefe * 22 }}>
                        <span className="row" style={{ gap: 9 }}>
                          <DocKindIcon kind={doc.kind} />
                          <span style={{ minWidth: 0 }}>
                            <span className="num">{doc.nummer}</span>
                            <div>
                              <strong>{doc.titel}</strong>
                            </div>
                          </span>
                        </span>
                      </td>
                      <td className="small muted col-optional">{doc.gewerk || '–'}</td>
                      <td className="small muted col-optional">{doc.planungsphase || '–'}</td>
                      <td className="num col-optional">{doc.index || '–'}</td>
                      <td className="small col-optional">{doc.eingangSoll ? formatDate(doc.eingangSoll) : '–'}</td>
                      <td>
                        <Badge ton={stand.ton}>{stand.text}</Badge>
                        {stand.run && istAktiv(stand.run) ? (
                          <div className="row" style={{ gap: 7, marginTop: 5 }}>
                            <Progress wert={fortschritt(stand.run)} />
                            <span className="small tertiary">{fortschritt(stand.run)} %</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="actions">
                        {stand.rang === 0 ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlanlaufStarten(doc);
                            }}
                            title="Planlauf für diesen Eintrag starten"
                          >
                            <Icon name="kette" size={13} /> Planlauf starten
                          </button>
                        ) : (
                          <span className="small tertiary">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog ? <PlanDialog project={project} doc={dialog.doc} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function PlanDialog({
  project,
  doc,
  onClose,
}: {
  project: Project;
  doc?: PlanDocument;
  onClose: () => void;
}) {
  const { data, addDocument, updateDocument, deleteDocument } = useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);
  const [form, setForm] = useState({
    kind: doc?.kind ?? ('plan' as DocumentKind),
    parentId: doc?.parentId ?? (null as ID | null),
    nummer: doc?.nummer ?? '',
    titel: doc?.titel ?? '',
    index: doc?.index ?? '',
    gewerk: doc?.gewerk ?? '',
    planungsphase: doc?.planungsphase ?? '',
    eingangSoll: doc?.eingangSoll ?? '',
    bemerkung: doc?.bemerkung ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const moeglicheEltern = data.documents.filter(
    (d) => d.projectId === project.id && d.id !== doc?.id && d.kind !== 'plan',
  );

  const speichern = () => {
    if (!form.titel.trim()) {
      toast('Bitte einen Titel angeben.');
      return;
    }
    const werte = { ...form, eingangSoll: form.eingangSoll || null };
    if (doc) updateDocument(doc.id, werte);
    else addDocument({ ...werte, projectId: project.id });
    toast(doc ? 'Eintrag aktualisiert.' : 'Eintrag angelegt.');
    onClose();
  };

  return (
    <>
      <Modal
        titel={doc ? `${DOCUMENT_KIND_LABEL[doc.kind]} bearbeiten` : 'Neuer Eintrag'}
        sub={doc ? doc.nummer : 'Plan, Planpaket oder Planverzeichnis'}
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
              Speichern
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Art">
            <Select
              value={form.kind}
              onChange={(v) => set('kind', v as DocumentKind)}
              options={Object.entries(DOCUMENT_KIND_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Übergeordnet" hint="Paket oder Verzeichnis">
            <Select
              value={form.parentId ?? ''}
              onChange={(v) => set('parentId', v || null)}
              placeholder="– keines –"
              options={moeglicheEltern.map((d) => ({ value: d.id, label: `${d.nummer} · ${d.titel}` }))}
            />
          </Field>
          <Field label="Nummer">
            <TextInput value={form.nummer} onChange={(v) => set('nummer', v)} placeholder="A-GR-101" />
          </Field>
          <Field label="Index / Revision" hint="bleibt leer, solange kein Index vergeben ist">
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
          <Field label="Eingang Soll">
            <TextInput value={form.eingangSoll} onChange={(v) => set('eingangSoll', v)} type="date" />
          </Field>
          <Field label="Bemerkung" full>
            <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
          </Field>
        </div>
      </Modal>

      {loeschen && doc ? (
        <ConfirmDialog
          titel="Eintrag löschen?"
          text={`„${doc.titel}“ und alle zugehörigen Planläufe werden gelöscht. Untergeordnete Einträge bleiben erhalten.`}
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
