/** Pläne, Planpakete und Planverzeichnisse eines Projekts (hierarchisch). */
import { useState } from 'react';
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_STATUS_LABEL,
  type DocumentKind,
  type DocumentStatus,
  type PlanDocument,
  type Project,
} from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { DocKindIcon, DocStatusBadge } from '../../components/common';
import {
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Search,
  Segmented,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';

type Filter = 'alle' | DocumentKind;

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
  const [dialog, setDialog] = useState<{ doc?: PlanDocument; parentId?: string | null } | null>(null);

  const alle = data.documents.filter((d) => d.projectId === project.id);
  const passt = (d: PlanDocument) =>
    (filter === 'alle' || d.kind === filter) &&
    [d.nummer, d.titel, d.gewerk, d.index].join(' ').toLowerCase().includes(suche.toLowerCase());

  const gefiltert = alle.filter(passt);
  const wurzeln = gefiltert.filter((d) => !d.parentId || !gefiltert.some((p) => p.id === d.parentId));

  const zeilen: { doc: PlanDocument; tiefe: number }[] = [];
  const sammle = (doc: PlanDocument, tiefe: number) => {
    zeilen.push({ doc, tiefe });
    gefiltert
      .filter((d) => d.parentId === doc.id)
      .sort((a, b) => a.nummer.localeCompare(b.nummer, 'de'))
      .forEach((k) => sammle(k, tiefe + 1));
  };
  wurzeln.sort((a, b) => a.nummer.localeCompare(b.nummer, 'de')).forEach((d) => sammle(d, 0));

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
        <CardHeader titel="Planbestand" sub="Planpakete können Pläne enthalten, Verzeichnisse fassen Pläne zusammen" />
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
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Nummer / Titel</th>
                <th className="col-optional">Art</th>
                <th>Index</th>
                <th className="col-optional">Gewerk</th>
                <th className="col-optional">Verantwortlich</th>
                <th>Status</th>
                <th className="col-optional">Planläufe</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody>
              {zeilen.map(({ doc, tiefe }) => {
                const verantwortlich = data.contacts.find((c) => c.id === doc.verantwortlichContactId);
                const laeufe = data.runs.filter((r) => r.documentId === doc.id);
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
                    <td className="small muted col-optional">{DOCUMENT_KIND_LABEL[doc.kind]}</td>
                    <td className="num">{doc.index || '–'}</td>
                    <td className="small muted col-optional">{doc.gewerk || '–'}</td>
                    <td className="small col-optional">
                      {verantwortlich ? (
                        `${verantwortlich.vorname} ${verantwortlich.nachname}`
                      ) : (
                        <span className="tertiary">–</span>
                      )}
                    </td>
                    <td><DocStatusBadge status={doc.status} /></td>
                    <td className="small muted col-optional">{laeufe.length > 0 ? `${laeufe.length}` : <span className="tertiary">–</span>}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlanlaufStarten(doc);
                        }}
                        title="Planlauf für diesen Eintrag starten"
                      >
                        <Icon name="kette" size={13} /> Planlauf
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      {dialog ? (
        <PlanDialog
          project={project}
          doc={dialog.doc}
          parentId={dialog.parentId ?? null}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function PlanDialog({
  project,
  doc,
  parentId,
  onClose,
}: {
  project: Project;
  doc?: PlanDocument;
  parentId: string | null;
  onClose: () => void;
}) {
  const { data, addDocument, updateDocument, deleteDocument } = useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);
  const [form, setForm] = useState({
    kind: doc?.kind ?? ('plan' as DocumentKind),
    parentId: doc?.parentId ?? parentId,
    nummer: doc?.nummer ?? '',
    titel: doc?.titel ?? '',
    index: doc?.index ?? 'A',
    massstab: doc?.massstab ?? '',
    gewerk: doc?.gewerk ?? '',
    status: doc?.status ?? ('entwurf' as DocumentStatus),
    verantwortlichContactId: doc?.verantwortlichContactId ?? null,
    bemerkung: doc?.bemerkung ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const moeglicheEltern = data.documents.filter(
    (d) => d.projectId === project.id && d.id !== doc?.id && d.kind !== 'plan',
  );
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);

  const speichern = () => {
    if (!form.titel.trim()) {
      toast('Bitte einen Titel angeben.');
      return;
    }
    if (doc) updateDocument(doc.id, form);
    else addDocument({ ...form, projectId: project.id });
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
          <Field label="Index / Revision">
            <TextInput value={form.index} onChange={(v) => set('index', v)} />
          </Field>
          <Field label="Titel" full>
            <TextInput value={form.titel} onChange={(v) => set('titel', v)} />
          </Field>
          <Field label="Gewerk">
            <TextInput value={form.gewerk} onChange={(v) => set('gewerk', v)} placeholder="Architektur, TGA …" />
          </Field>
          <Field label="Maßstab">
            <TextInput value={form.massstab} onChange={(v) => set('massstab', v)} placeholder="1:50" />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => set('status', v as DocumentStatus)}
              options={Object.entries(DOCUMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Verantwortlich">
            <Select
              value={form.verantwortlichContactId ?? ''}
              onChange={(v) => set('verantwortlichContactId', v || null)}
              placeholder="– niemand –"
              options={kontakte.map((c) => ({ value: c.id, label: `${c.vorname} ${c.nachname} (${c.firma})` }))}
            />
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
