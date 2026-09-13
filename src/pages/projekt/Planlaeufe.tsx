/** Liste der Planläufe eines Projekts sowie der Startdialog für neue Läufe. */
import { useState } from 'react';
import { aktuellerSchritt, ampelFuerSchritt, fortschritt, stepsAusTemplate, templateDauer } from '../../domain/engine';
import { formatDate, relativeLabel, tageLabel, today } from '../../lib/dates';
import type { PlanDocument, Project, RunStatus } from '../../domain/types';
import { RUN_STATUS_LABEL } from '../../domain/types';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { AmpelPunkt, RunStatusBadge } from '../../components/common';
import { Callout, Card, CardHeader, EmptyState, Field, Modal, Progress, Select, TextArea, TextInput } from '../../components/ui';
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
  const offen = laeufe.filter((r) => r.status === 'laufend' || r.status === 'geplant');
  const erledigt = laeufe.filter((r) => r.status === 'abgeschlossen' || r.status === 'abgebrochen');

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="muted small">
          Ein Planlauf ist eine laufende Prozesskette für einen Plan, ein Paket oder ein Verzeichnis.
          Abweichungen vom Standard wirken sich nur auf den jeweiligen Lauf aus.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setStartDialog(true)}>
          <Icon name="plus" size={14} /> Planlauf starten
        </button>
      </div>

      <LaufTabelle titel="Aktive Planläufe" laeufe={offen} project={project} onOeffnen={onOeffnen} leerAktion={() => setStartDialog(true)} />
      {erledigt.length > 0 ? (
        <LaufTabelle titel="Abgeschlossen" laeufe={erledigt} project={project} onOeffnen={onOeffnen} />
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
  laeufe,
  project,
  onOeffnen,
  leerAktion,
}: {
  titel: string;
  laeufe: ReturnType<typeof useStore>['data']['runs'];
  project: Project;
  onOeffnen: (runId: string) => void;
  leerAktion?: () => void;
}) {
  const { data } = useStore();
  return (
    <Card>
      <CardHeader titel={titel} sub={`${laeufe.length} Planläufe`} />
      {laeufe.length === 0 ? (
        <EmptyState
          icon="kette"
          titel="Kein Planlauf vorhanden"
          text="Starten Sie einen Lauf auf Basis einer Standard-Prozesskette."
          action={
            leerAktion ? (
              <button type="button" className="btn btn-primary" onClick={leerAktion}>
                <Icon name="plus" size={14} /> Planlauf starten
              </button>
            ) : undefined
          }
        />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Planlauf</th>
              <th>Plan / Paket</th>
              <th>Aktueller Schritt</th>
              <th style={{ width: 140 }}>Fortschritt</th>
              <th>Ende (Soll)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {laeufe.map((run) => {
              const doc = data.documents.find((d) => d.id === run.documentId);
              const step = aktuellerSchritt(run);
              const ampel = step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'erledigt';
              const pct = fortschritt(run);
              const ende = run.steps[run.steps.length - 1]?.sollDatum ?? null;
              const abweichungen = run.steps.filter((s) => s.abweichung).length;
              return (
                <tr key={run.id} className="clickable" onClick={() => onOeffnen(run.id)}>
                  <td>
                    <strong>{run.name}</strong>
                    <div className="small tertiary">
                      {run.templateName}
                      {abweichungen > 0 ? ` · ${abweichungen} Abweichung${abweichungen > 1 ? 'en' : ''}` : ''}
                    </div>
                  </td>
                  <td className="small muted">
                    {doc ? (
                      <>
                        <span className="num">{doc.nummer}</span> {doc.titel}
                      </>
                    ) : (
                      <span className="tertiary">–</span>
                    )}
                  </td>
                  <td className="small">
                    <span className="row" style={{ gap: 7 }}>
                      <AmpelPunkt ampel={ampel} />
                      {step?.name ?? 'alle Schritte erledigt'}
                    </span>
                    {step ? <span className="tertiary small">{relativeLabel(step.sollDatum)}</span> : null}
                  </td>
                  <td>
                    <span className="row" style={{ gap: 8 }}>
                      <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : pct === 100 ? 'green' : ''} />
                      <span className="small tertiary">{pct}%</span>
                    </span>
                  </td>
                  <td className="small">{formatDate(ende)}</td>
                  <td><RunStatusBadge status={run.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  const template = vorlagen.find((t) => t.id === templateId);
  const doc = dokumente.find((d) => d.id === documentId);

  /** Ordnet jedem Schritt automatisch die Person zu, die die Rolle innehat. */
  const kontaktFuerRolle = (roleName: string): string | null => {
    const rolle = rollen.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    if (!rolle) return null;
    return kontakte.find((c) => c.roleIds.includes(rolle.id))?.id ?? null;
  };

  const starten = () => {
    if (!doc || !template) {
      toast('Bitte Plan und Prozesskette wählen.');
      return;
    }
    const steps = stepsAusTemplate(template, kontaktFuerRolle, () => newId('rs'));
    const ohneKontakt = steps.filter((s) => !s.contactId).length;
    const id = addRun({
      projectId: project.id,
      documentId: doc.id,
      templateId: template.id,
      templateName: template.name,
      name: name.trim() || `Planlauf ${doc.nummer} Index ${doc.index}`,
      start,
      status: 'laufend' as RunStatus,
      steps,
      bemerkung,
    });
    toast(
      ohneKontakt > 0
        ? `Planlauf gestartet – ${ohneKontakt} Schritt(e) noch ohne Person.`
        : 'Planlauf gestartet.',
    );
    onFertig(id);
  };

  return (
    <Modal
      titel="Planlauf starten"
      sub="Prozesskette auswählen – Abweichungen sind danach jederzeit möglich"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={starten} disabled={!doc || !template}>
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
          <Field label="Prozesskette" full hint={template ? template.beschreibung : undefined}>
            <Select
              value={templateId}
              onChange={setTemplateId}
              options={vorlagen.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.steps.length} Schritte, ${templateDauer(t)} Tage)`,
              }))}
            />
          </Field>
          <Field label="Startdatum">
            <TextInput value={start} onChange={setStart} type="date" />
          </Field>
          <Field label="Bezeichnung" hint="leer = automatisch">
            <TextInput value={name} onChange={setName} placeholder={doc ? `Planlauf ${doc.nummer} Index ${doc.index}` : ''} />
          </Field>
          <Field label="Bemerkung" full>
            <TextArea value={bemerkung} onChange={setBemerkung} rows={2} />
          </Field>
        </div>

        {template ? (
          <div>
            <h3 style={{ marginBottom: 8 }}>Vorschau der Schritte</h3>
            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Schritt</th>
                    <th>Rolle</th>
                    <th>Frist</th>
                    <th>Zuständig</th>
                  </tr>
                </thead>
                <tbody>
                  {template.steps.map((s, i) => {
                    const cid = kontaktFuerRolle(s.roleName);
                    const kontakt = kontakte.find((c) => c.id === cid);
                    return (
                      <tr key={s.id}>
                        <td className="num">{i + 1}</td>
                        <td>{s.name}</td>
                        <td className="small muted">{s.roleName || '–'}</td>
                        <td className="small">{tageLabel(s.fristTage)}</td>
                        <td className="small">
                          {kontakt ? (
                            `${kontakt.vorname} ${kontakt.nachname}`
                          ) : (
                            <span className="tertiary">offen</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small tertiary" style={{ marginTop: 8 }}>
              Gesamtdauer laut Vorlage: {templateDauer(template)} {project.settings.fristenInArbeitstagen ? 'Arbeitstage' : 'Kalendertage'} · Status:{' '}
              {RUN_STATUS_LABEL.laufend}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
