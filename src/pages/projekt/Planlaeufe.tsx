/** Liste der Planläufe eines Projekts sowie der Startdialog für neue Läufe. */
import { useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  fortschritt,
  istAktiv,
  pfad,
  stepsAusTemplate,
} from '../../domain/engine';
import { formatDate, relativeLabel, tageLabel, today } from '../../lib/dates';
import type { PlanDocument, PlanRun, ProcessTemplateStep, Project } from '../../domain/types';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { AmpelPunkt, RunStatusBadge } from '../../components/common';
import { SchrittListe } from '../Prozessketten';
import {
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  Progress,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';

export function Planlaeufe({
  project,
  onOeffnen,
  startFuerDokument,
  onStartDialogSchliessen,
}: {
  project: Project;
  onOeffnen: (runId: string) => void;
  startFuerDokument?: PlanDocument | null;
  onStartDialogSchliessen: () => void;
}) {
  const { data } = useStore();
  const [startDialog, setStartDialog] = useState(false);

  const laeufe = data.runs.filter((r) => r.projectId === project.id);
  const aktiv = laeufe.filter(istAktiv);
  const beendet = laeufe.filter((r) => !istAktiv(r));

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="muted small" style={{ maxWidth: 620 }}>
          Ein Planlauf ist eine laufende Prozesskette für einen Plan, ein Paket oder ein Verzeichnis.
          Abweichungen wirken sich nur auf den jeweiligen Lauf aus.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setStartDialog(true)}>
          <Icon name="plus" size={14} /> Planlauf starten
        </button>
      </div>

      <LaufTabelle
        titel="Aktive Planläufe"
        laeufe={aktiv}
        project={project}
        onOeffnen={onOeffnen}
        leerAktion={() => setStartDialog(true)}
      />
      {beendet.length > 0 ? (
        <LaufTabelle
          titel="Abgeschlossen & abgebrochen"
          laeufe={beendet}
          project={project}
          onOeffnen={onOeffnen}
          sub="Abgebrochene Läufe erscheinen nur in dieser Projektansicht"
        />
      ) : null}

      {startDialog || startFuerDokument ? (
        <StartDialog
          project={project}
          vorauswahl={startFuerDokument ?? null}
          onClose={() => {
            setStartDialog(false);
            onStartDialogSchliessen();
          }}
          onFertig={(id) => {
            setStartDialog(false);
            onStartDialogSchliessen();
            onOeffnen(id);
          }}
        />
      ) : null}
    </div>
  );
}

function LaufTabelle({
  titel,
  sub,
  laeufe,
  project,
  onOeffnen,
  leerAktion,
}: {
  titel: string;
  sub?: string;
  laeufe: PlanRun[];
  project: Project;
  onOeffnen: (runId: string) => void;
  leerAktion?: () => void;
}) {
  const { data } = useStore();
  return (
    <Card>
      <CardHeader titel={titel} sub={sub ?? `${laeufe.length} Planläufe`} />
      {laeufe.length === 0 ? (
        <EmptyState
          icon="kette"
          titel="Kein Planlauf vorhanden"
          text="Starten Sie einen Lauf auf Basis einer Prozesskette."
          action={
            leerAktion ? (
              <button type="button" className="btn btn-primary" onClick={leerAktion}>
                <Icon name="plus" size={14} /> Planlauf starten
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Planlauf</th>
                <th className="col-optional">Plan / Paket</th>
                <th>Aktueller Schritt</th>
                <th style={{ width: 140 }}>Fortschritt</th>
                <th className="col-optional">Ende (Soll)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {laeufe.map((run) => {
                const doc = data.documents.find((d) => d.id === run.documentId);
                const step = aktuellerSchritt(run);
                const ampel = step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'erledigt';
                const pct = fortschritt(run);
                const reihenfolge = pfad(run.steps);
                const ende = reihenfolge[reihenfolge.length - 1]?.sollDatum ?? null;
                const abweichungen = run.steps.filter((s) => s.abweichung).length;
                const abgebrochen = run.status === 'abgebrochen';
                return (
                  <tr
                    key={run.id}
                    className="clickable"
                    style={abgebrochen ? { opacity: 0.55 } : undefined}
                    onClick={() => onOeffnen(run.id)}
                  >
                    <td>
                      <strong>{run.name}</strong>
                      <div className="small tertiary">
                        {run.templateName}
                        {abweichungen > 0 ? ` · ${abweichungen} Abweichung${abweichungen > 1 ? 'en' : ''}` : ''}
                      </div>
                      {abgebrochen && run.abbruchGrund ? (
                        <div className="small" style={{ color: 'var(--red)' }}>
                          Abgebrochen{run.abbruchDatum ? ` am ${formatDate(run.abbruchDatum)}` : ''}: {run.abbruchGrund}
                        </div>
                      ) : null}
                    </td>
                    <td className="small muted col-optional">
                      {doc ? (
                        <>
                          <span className="num">{doc.nummer}</span> {doc.titel}
                        </>
                      ) : (
                        <span className="tertiary">–</span>
                      )}
                    </td>
                    <td className="small">
                      {abgebrochen ? (
                        <span className="tertiary">–</span>
                      ) : (
                        <>
                          <span className="row" style={{ gap: 7 }}>
                            <AmpelPunkt ampel={ampel} />
                            {step?.name ?? 'alle Schritte erledigt'}
                          </span>
                          {step ? <span className="tertiary small">{relativeLabel(step.sollDatum)}</span> : null}
                        </>
                      )}
                    </td>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : pct === 100 ? 'green' : ''} />
                        <span className="small tertiary">{pct}%</span>
                      </span>
                    </td>
                    <td className="small col-optional">{formatDate(ende)}</td>
                    <td>
                      <RunStatusBadge status={run.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StartDialog({
  project,
  vorauswahl,
  onClose,
  onFertig,
}: {
  project: Project;
  vorauswahl: PlanDocument | null;
  onClose: () => void;
  onFertig: (runId: string) => void;
}) {
  const { data, addRun } = useStore();
  const toast = useToast();

  const dokumente = data.documents.filter((d) => d.projectId === project.id);
  const vorlagen = data.templates.filter((t) => t.projectId === null || t.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);
  const rollen = data.roles.filter((r) => r.projectId === project.id);

  const [documentId, setDocumentId] = useState(vorauswahl?.id ?? dokumente[0]?.id ?? '');
  const [templateId, setTemplateId] = useState(vorlagen[0]?.id ?? '');
  const [start, setStart] = useState(today());
  const [name, setName] = useState('');
  const [bemerkung, setBemerkung] = useState('');

  /** Bearbeitbare Kopie der Schritte – Grundlage des neuen Laufs. */
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

  const [steps, setSteps] = useState<ProcessTemplateStep[]>(() => kopie(vorlagen[0]?.id ?? ''));

  const vorlageWechseln = (id: string) => {
    setTemplateId(id);
    setSteps(kopie(id));
  };

  const template = vorlagen.find((t) => t.id === templateId);
  const doc = dokumente.find((d) => d.id === documentId);

  /** Ordnet jedem Schritt automatisch die Person zu, die die Rolle innehat. */
  const kontaktFuerRolle = (roleName: string): string | null => {
    const rolle = rollen.find((r) => r.name.toLowerCase() === roleName.trim().toLowerCase());
    if (!rolle) return null;
    return kontakte.find((c) => c.roleIds.includes(rolle.id))?.id ?? null;
  };

  const starten = () => {
    if (!doc) {
      toast('Bitte einen Plan wählen.');
      return;
    }
    if (steps.length === 0 || steps.some((s) => !s.name.trim())) {
      toast('Bitte jeden Schritt benennen.');
      return;
    }
    const runSteps = stepsAusTemplate(
      { id: templateId, projectId: null, name: '', beschreibung: '', herkunft: 'manuell', steps },
      kontaktFuerRolle,
      () => newId('rs'),
    );
    // Abweichungen gegenüber der gewählten Vorlage kennzeichnen
    const original = template?.steps ?? [];
    const markiert = runSteps.map((s, i) => {
      const vorlage = original[i];
      const abweichend =
        !vorlage ||
        vorlage.name !== s.name ||
        vorlage.fristTage !== s.fristTage ||
        vorlage.roleName !== s.roleName ||
        vorlage.typ !== s.typ ||
        original.length !== runSteps.length;
      return abweichend ? { ...s, abweichung: true } : s;
    });

    const id = addRun({
      projectId: project.id,
      documentId: doc.id,
      templateId: template?.id ?? null,
      templateName: template?.name ?? 'Individuelle Kette',
      name: name.trim() || `Planlauf ${doc.nummer}${doc.index ? ` Index ${doc.index}` : ''}`,
      start,
      status: 'laufend',
      abbruchGrund: null,
      abbruchDatum: null,
      steps: markiert,
      bemerkung,
    });

    const ohneKontakt = markiert.filter((s) => !s.contactId).length;
    toast(
      ohneKontakt > 0
        ? `Planlauf gestartet – ${ohneKontakt} Schritt(e) noch ohne Person.`
        : 'Planlauf gestartet.',
    );
    onFertig(id);
  };

  const dauer = steps.reduce((s, x) => s + x.fristTage, 0);

  return (
    <Modal
      titel="Planlauf starten"
      sub="Prozesskette auswählen und für diesen Lauf anpassen"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={starten} disabled={!doc}>
            Planlauf starten
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        {dokumente.length === 0 ? (
          <Callout ton="warn" icon="!">
            Im Projekt ist noch kein Plan erfasst. Legen Sie zuerst unter <strong>Pläne & Pakete</strong> einen
            Eintrag an.
          </Callout>
        ) : null}

        <div className="form-grid">
          <Field label="Plan / Paket / Verzeichnis" full>
            <Select
              value={documentId}
              onChange={setDocumentId}
              options={dokumente.map((d) => ({ value: d.id, label: `${d.nummer} · ${d.titel}` }))}
            />
          </Field>
          <Field label="Prozesskette" full hint={template?.beschreibung}>
            <Select
              value={templateId}
              onChange={vorlageWechseln}
              options={vorlagen.map((t) => ({ value: t.id, label: `${t.name} (${t.steps.length} Schritte)` }))}
            />
          </Field>
          <Field label="Startdatum">
            <TextInput value={start} onChange={setStart} type="date" />
          </Field>
          <Field label="Bezeichnung" hint="leer = automatisch">
            <TextInput
              value={name}
              onChange={setName}
              placeholder={doc ? `Planlauf ${doc.nummer}` : ''}
            />
          </Field>
          <Field label="Bemerkung" full>
            <TextArea value={bemerkung} onChange={setBemerkung} rows={2} />
          </Field>
        </div>

        <div>
          <div className="row-between wrap" style={{ marginBottom: 8 }}>
            <h3>Schritte dieses Planlaufs</h3>
            <span className="small tertiary">
              {steps.length} Schritte · {tageLabel(dauer)} Gesamtdauer
              {project.settings.fristenInArbeitstagen ? ' (Arbeitstage)' : ''}
            </span>
          </div>
          <p className="small muted" style={{ marginBottom: 10 }}>
            Schritte lassen sich hier hinzufügen, ändern oder entfernen. Die gewählte Prozesskette bleibt davon
            unberührt; Änderungen gelten nur für diesen Lauf.
          </p>
          <SchrittListe steps={steps} setSteps={setSteps} rollen={[...new Set(rollen.map((r) => r.name))]} />
        </div>
      </div>
    </Modal>
  );
}
