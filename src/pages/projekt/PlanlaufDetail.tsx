/**
 * Detailansicht eines Planlaufs: Prozesskette als Zeitstrahl, Soll-/Ist-Termine,
 * individuelle Abweichungen und die Erinnerungsfunktion je Schritt.
 */
import { useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  fortschritt,
  verzugTage,
  type Ampel,
} from '../../domain/engine';
import { formatDate, formatDateShort, relativeLabel, tageLabel, today } from '../../lib/dates';
import {
  RUN_STATUS_LABEL,
  STEP_STATUS_LABEL,
  STEP_TYPE_LABEL,
  type PlanRun,
  type Project,
  type RunStatus,
  type RunStep,
  type StepStatus,
  type StepType,
} from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { AmpelBadge, RunStatusBadge, StepTypBadge } from '../../components/common';
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  Field,
  Modal,
  Progress,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { EmailDialog } from '../../components/EmailDialog';
import { Icon } from '../../components/icons';

export function PlanlaufDetail({
  project,
  run,
  onZurueck,
}: {
  project: Project;
  run: PlanRun;
  onZurueck: () => void;
}) {
  const { data, updateRun, updateStep, deleteStep, moveStep, addStep, deleteRun } = useStore();
  const toast = useToast();
  const [mailStep, setMailStep] = useState<RunStep | null>(null);
  const [bearbeiten, setBearbeiten] = useState<RunStep | null>(null);
  const [neuerSchritt, setNeuerSchritt] = useState(false);
  const [laufLoeschen, setLaufLoeschen] = useState(false);

  const doc = data.documents.find((d) => d.id === run.documentId);
  const aktiv = aktuellerSchritt(run);
  const pct = fortschritt(run);
  const verzug = verzugTage(run);
  const vorlauf = project.settings.erinnerungVorlaufTage;
  const abweichungen = run.steps.filter((s) => s.abweichung).length;

  const setzeStatus = (step: RunStep, status: StepStatus) => {
    const patch: Partial<RunStep> = { status };
    if (status === 'erledigt' && !step.istDatum) patch.istDatum = today();
    if (status === 'offen' || status === 'laufend') patch.istDatum = null;
    updateStep(run.id, step.id, patch);

    // Nächsten Schritt automatisch auf "laufend" setzen
    if (status === 'erledigt') {
      const idx = run.steps.findIndex((s) => s.id === step.id);
      const naechster = run.steps.slice(idx + 1).find((s) => s.status === 'offen');
      if (naechster) updateStep(run.id, naechster.id, { status: 'laufend' });
      const restOffen = run.steps.filter((s) => s.id !== step.id && s.status !== 'erledigt' && s.status !== 'uebersprungen');
      if (restOffen.length === 0) {
        updateRun(run.id, { status: 'abgeschlossen' });
        toast('Alle Schritte erledigt – Planlauf abgeschlossen.');
        return;
      }
    }
    toast(`„${step.name}“: ${STEP_STATUS_LABEL[status]}`);
  };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <button type="button" className="btn btn-ghost" onClick={onZurueck}>
          <Icon name="zurueck" size={14} /> Planläufe
        </button>
        <div className="row">
          <Select
            value={run.status}
            onChange={(v) => updateRun(run.id, { status: v as RunStatus })}
            options={Object.entries(RUN_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <button type="button" className="btn btn-danger" onClick={() => setLaufLoeschen(true)}>
            <Icon name="loeschen" size={14} /> Lauf löschen
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <Card>
          <div className="stat">
            <div className="stat-value">{pct}%</div>
            <div className="stat-label">Fortschritt</div>
            <div style={{ marginTop: 8 }}>
              <Progress wert={pct} ton={verzug > 0 ? 'red' : pct === 100 ? 'green' : ''} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-value" style={{ fontSize: 17, paddingTop: 8 }}>
              {aktiv?.name ?? 'abgeschlossen'}
            </div>
            <div className="stat-label">Aktueller Schritt · {relativeLabel(aktiv?.sollDatum ?? null)}</div>
          </div>
        </Card>
        <Card>
          <div className={`stat ${verzug > 0 ? 'red' : 'green'}`}>
            <div className="stat-value">{verzug > 0 ? `${verzug} T` : 'im Plan'}</div>
            <div className="stat-label">{verzug > 0 ? 'Verzug gegenüber Soll' : 'Kein Verzug'}</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-value" style={{ fontSize: 17, paddingTop: 8 }}>
              {formatDate(run.steps[run.steps.length - 1]?.sollDatum ?? null)}
            </div>
            <div className="stat-label">Soll-Ende des Laufs</div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          titel={run.name}
          sub={
            <>
              {doc ? `${doc.nummer} · ${doc.titel} (Index ${doc.index})` : 'ohne Plan'} · Start{' '}
              {formatDate(run.start)} · Vorlage: {run.templateName}
            </>
          }
          actions={<RunStatusBadge status={run.status} />}
        />
        <div className="card-pad">
          <div className="chain">
            {run.steps.map((s, i) => {
              const ampel = ampelFuerSchritt(s, vorlauf);
              const klasse =
                ampel === 'erledigt'
                  ? 'done'
                  : ampel === 'ueberfaellig'
                    ? 'late'
                    : s.id === aktiv?.id
                      ? 'current'
                      : '';
              return (
                <div key={s.id} className="row" style={{ gap: 0 }}>
                  <div className={`chain-node ${klasse} ${s.typ === 'gateway' ? 'gateway' : ''}`}>
                    <div className="cn-name">{s.name}</div>
                    <div className="cn-meta">
                      {s.roleName || STEP_TYPE_LABEL[s.typ]}
                      <br />
                      {s.istDatum ? `Ist ${formatDateShort(s.istDatum)}` : `Soll ${formatDateShort(s.sollDatum)}`}
                      {s.abweichung ? ' · abweichend' : ''}
                    </div>
                  </div>
                  {i < run.steps.length - 1 ? (
                    <div className="chain-arrow">
                      <Icon name="chevron" size={13} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {abweichungen > 0 ? (
            <Callout ton="warn" icon="!">
              {abweichungen} Schritt(e) weichen von der Standard-Prozesskette ab. Änderungen wirken nur in diesem
              Planlauf.
            </Callout>
          ) : null}
          {run.bemerkung ? <p className="small muted" style={{ marginTop: 10 }}>{run.bemerkung}</p> : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          titel="Prozessschritte"
          sub="Soll-Termine ergeben sich aus den Fristen; Ist-Termine dokumentieren die Erledigung"
          actions={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setNeuerSchritt(true)}>
              <Icon name="plus" size={13} /> Schritt einfügen
            </button>
          }
        />
        {run.steps.map((step, i) => {
          const ampel: Ampel = ampelFuerSchritt(step, vorlauf);
          const kontakt = data.contacts.find((c) => c.id === step.contactId);
          const istAktiv = step.id === aktiv?.id;
          return (
            <div className={`step-row ${istAktiv ? 'aktiv' : ''}`} key={step.id}>
              <div className="step-marker">
                <div
                  className={`step-num ${
                    ampel === 'erledigt' ? 'done' : ampel === 'ueberfaellig' ? 'late' : istAktiv ? 'current' : ''
                  }`}
                >
                  {ampel === 'erledigt' ? <Icon name="check" size={12} strokeWidth={2.4} /> : i + 1}
                </div>
                {i < run.steps.length - 1 ? <div className="step-line" /> : null}
              </div>

              <div className="step-body">
                <div className="step-title">
                  <strong>{step.name}</strong>
                  <StepTypBadge typ={step.typ} />
                  <AmpelBadge ampel={ampel} />
                  {step.abweichung ? <Badge ton="orange">Abweichung</Badge> : null}
                </div>

                <div className="step-meta">
                  <span>
                    Rolle: <b>{step.roleName || '–'}</b>
                  </span>
                  <span>
                    Zuständig:{' '}
                    <b>{kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : 'nicht zugeordnet'}</b>
                  </span>
                  <span>
                    Frist: <b>{tageLabel(step.fristTage)}</b>
                  </span>
                  <span>
                    Soll: <b>{formatDate(step.sollDatum)}</b>
                    {step.sollManuell ? ' (fest)' : ''}
                  </span>
                  <span>
                    Ist: <b>{formatDate(step.istDatum)}</b>
                  </span>
                </div>

                {step.bemerkung ? <p className="small tertiary">{step.bemerkung}</p> : null}

                <div className="step-actions">
                  {step.status !== 'erledigt' ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setzeStatus(step, 'erledigt')}>
                      <Icon name="check" size={13} /> Erledigt
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={() => setzeStatus(step, 'laufend')}>
                      Wieder öffnen
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setMailStep(step)}
                    disabled={step.status === 'erledigt'}
                    title="Vorgefertigte E-Mail an die zuständige Person"
                  >
                    <Icon name="mail" size={13} /> Erinnern
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setBearbeiten(step)}>
                    <Icon name="bearbeiten" size={13} /> Anpassen
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => moveStep(run.id, step.id, -1)}
                    disabled={i === 0}
                    aria-label="Nach oben"
                  >
                    <Icon name="hoch" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => moveStep(run.id, step.id, 1)}
                    disabled={i === run.steps.length - 1}
                    aria-label="Nach unten"
                  >
                    <Icon name="runter" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => {
                      deleteStep(run.id, step.id);
                      toast('Schritt entfernt.');
                    }}
                    aria-label="Schritt entfernen"
                  >
                    <Icon name="loeschen" size={14} />
                  </button>
                  {step.letzteErinnerung ? (
                    <span className="small tertiary">
                      erinnert am {new Date(step.letzteErinnerung).toLocaleDateString('de-DE')}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {mailStep ? (
        <EmailDialog project={project} run={run} step={mailStep} onClose={() => setMailStep(null)} />
      ) : null}

      {bearbeiten ? (
        <SchrittDialog
          project={project}
          run={run}
          step={bearbeiten}
          onClose={() => setBearbeiten(null)}
        />
      ) : null}

      {neuerSchritt ? (
        <SchrittDialog
          project={project}
          run={run}
          onClose={() => setNeuerSchritt(false)}
          onAnlegen={(werte) => {
            addStep(run.id, {
              ...werte,
              sollDatum: null,
              istDatum: null,
              status: 'offen',
              abweichung: true,
              letzteErinnerung: null,
            });
            toast('Schritt eingefügt – als Abweichung markiert.');
          }}
        />
      ) : null}

      {laufLoeschen ? (
        <ConfirmDialog
          titel="Planlauf löschen?"
          text={`„${run.name}“ wird mit allen Terminen dauerhaft gelöscht.`}
          onConfirm={() => {
            deleteRun(run.id);
            toast('Planlauf gelöscht.');
            onZurueck();
          }}
          onClose={() => setLaufLoeschen(false)}
        />
      ) : null}
    </div>
  );
}

type SchrittWerte = {
  name: string;
  typ: StepType;
  roleName: string;
  contactId: string | null;
  fristTage: number;
  sollManuell: boolean;
  bemerkung: string;
};

function SchrittDialog({
  project,
  run,
  step,
  onClose,
  onAnlegen,
}: {
  project: Project;
  run: PlanRun;
  step?: RunStep;
  onClose: () => void;
  onAnlegen?: (werte: SchrittWerte & { sollDatum: null }) => void;
}) {
  const { data, updateStep } = useStore();
  const toast = useToast();
  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);

  const [form, setForm] = useState({
    name: step?.name ?? '',
    typ: step?.typ ?? ('task' as StepType),
    roleName: step?.roleName ?? '',
    contactId: step?.contactId ?? null,
    fristTage: step?.fristTage ?? 5,
    sollManuell: step?.sollManuell ?? false,
    sollDatum: step?.sollDatum ?? today(),
    istDatum: step?.istDatum ?? '',
    status: step?.status ?? ('offen' as StepStatus),
    bemerkung: step?.bemerkung ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const speichern = () => {
    if (!form.name.trim()) {
      toast('Bitte einen Namen angeben.');
      return;
    }
    if (step) {
      const veraendert =
        form.name !== step.name ||
        form.fristTage !== step.fristTage ||
        form.roleName !== step.roleName ||
        form.typ !== step.typ ||
        form.sollManuell !== step.sollManuell;
      updateStep(run.id, step.id, {
        name: form.name,
        typ: form.typ,
        roleName: form.roleName,
        contactId: form.contactId,
        fristTage: Number(form.fristTage) || 0,
        sollManuell: form.sollManuell,
        sollDatum: form.sollManuell ? form.sollDatum : step.sollDatum,
        istDatum: form.istDatum || null,
        status: form.status,
        bemerkung: form.bemerkung,
        abweichung: step.abweichung || veraendert,
      });
      toast('Schritt angepasst.');
    } else {
      onAnlegen?.({
        name: form.name,
        typ: form.typ,
        roleName: form.roleName,
        contactId: form.contactId,
        fristTage: Number(form.fristTage) || 0,
        sollManuell: false,
        bemerkung: form.bemerkung,
        sollDatum: null,
      });
    }
    onClose();
  };

  return (
    <Modal
      titel={step ? 'Schritt anpassen' : 'Schritt einfügen'}
      sub="Änderungen gelten nur für diesen Planlauf (individuelle Abweichung)"
      onClose={onClose}
      footer={
        <>
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
        <Field label="Bezeichnung" full>
          <TextInput value={form.name} onChange={(v) => set('name', v)} />
        </Field>
        <Field label="Art">
          <Select
            value={form.typ}
            onChange={(v) => set('typ', v as StepType)}
            options={Object.entries(STEP_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Rolle">
          <Select
            value={form.roleName}
            onChange={(v) => set('roleName', v)}
            placeholder="– keine –"
            options={rollen.map((r) => ({ value: r.name, label: r.name }))}
          />
        </Field>
        <Field label="Zuständige Person">
          <Select
            value={form.contactId ?? ''}
            onChange={(v) => set('contactId', v || null)}
            placeholder="– offen –"
            options={kontakte.map((c) => ({ value: c.id, label: `${c.vorname} ${c.nachname} (${c.firma})` }))}
          />
        </Field>
        <Field label="Frist in Tagen" hint="ab Soll-Termin des Vorgängers">
          <TextInput
            value={String(form.fristTage)}
            onChange={(v) => set('fristTage', Number(v.replace(/\D/g, '')) || 0)}
            inputMode="numeric"
          />
        </Field>
        {step ? (
          <>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => set('status', v as StepStatus)}
                options={Object.entries(STEP_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Ist-Termin" hint="leer = noch nicht erledigt">
              <TextInput value={form.istDatum} onChange={(v) => set('istDatum', v)} type="date" />
            </Field>
            <Field label="Soll-Termin festsetzen" full hint="Überschreibt die Fristenrechnung ab diesem Schritt.">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.sollManuell}
                  onChange={(e) => set('sollManuell', e.target.checked)}
                />
                Soll-Termin manuell vorgeben
              </label>
              {form.sollManuell ? (
                <div style={{ marginTop: 8 }}>
                  <TextInput value={form.sollDatum ?? ''} onChange={(v) => set('sollDatum', v)} type="date" />
                </div>
              ) : null}
            </Field>
          </>
        ) : null}
        <Field label="Bemerkung" full>
          <TextArea value={form.bemerkung} onChange={(v) => set('bemerkung', v)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
