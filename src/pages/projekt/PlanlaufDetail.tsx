/**
 * Detailansicht eines Planlaufs: Prozesskette als Verlauf, Soll-/Ist-Termine,
 * Entscheidungen mit Antwortmöglichkeiten und die Erinnerungsfunktion.
 */
import { useState } from 'react';
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  massgeblicheAntwort,
  nichtImPfad,
  rueckSprungAnwenden,
  verlaufDerKette,
  type Ampel,
} from '../../domain/engine';
import { formatDate, tageLabel, today } from '../../lib/dates';
import {
  STEP_STATUS_LABEL,
  STEP_TYPE_LABEL,
  type PlanRun,
  type Project,
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
  const { data, updateRun, updateStep, addStep, deleteRun, abbrechenRun } = useStore();
  const toast = useToast();
  const [mailStep, setMailStep] = useState<RunStep | null>(null);
  const [bearbeiten, setBearbeiten] = useState<RunStep | null>(null);
  const [neuerSchritt, setNeuerSchritt] = useState(false);
  const [laufLoeschen, setLaufLoeschen] = useState(false);
  const [abbrechen, setAbbrechen] = useState(false);

  const doc = data.documents.find((d) => d.id === run.documentId);
  const { schritte: verlauf, rueckSprungZu } = verlaufDerKette(run.steps);
  const abseits = nichtImPfad(run.steps);
  const aktiv = aktuellerSchritt(run);
  const vorlauf = project.settings.erinnerungVorlaufTage;
  const abweichungen = run.steps.filter((s) => s.abweichung).length;
  const beendet = run.status !== 'laufend';

  /** Setzt den Status eines Schritts und rückt den Lauf ggf. weiter. */
  const setzeStatus = (step: RunStep, status: StepStatus) => {
    // Führt die Antwort einer Entscheidung zu einem bereits durchlaufenen
    // Schritt zurück, beginnt dort ein weiterer Durchlauf.
    if (step.typ === 'entscheidung' && status === 'erledigt') {
      const antwort = massgeblicheAntwort(step);
      const ziel = antwort?.ziel && antwort.ziel !== 'ende' ? antwort.ziel : null;
      const zielIstFrueher =
        ziel !== null &&
        verlauf.findIndex((s) => s.id === ziel) >= 0 &&
        verlauf.findIndex((s) => s.id === ziel) < verlauf.findIndex((s) => s.id === step.id);
      if (zielIstFrueher && ziel) {
        const erledigt = run.steps.map((s) =>
          s.id === step.id ? { ...s, status: 'erledigt' as const, istDatum: s.istDatum ?? today() } : s,
        );
        updateRun(run.id, { steps: rueckSprungAnwenden(erledigt, step.id, ziel) });
        const zielName = run.steps.find((s) => s.id === ziel)?.name ?? '';
        toast(`Rücksprung zu „${zielName}“ – weiterer Durchlauf gestartet.`);
        return;
      }
    }

    const patch: Partial<RunStep> = { status };
    if ((status === 'erledigt' || status === 'uebersprungen') && !step.istDatum) patch.istDatum = today();
    if (status === 'offen' || status === 'laufend') patch.istDatum = null;
    updateStep(run.id, step.id, patch);

    if (status === 'erledigt' || status === 'uebersprungen') {
      const aktualisiert = run.steps.map((s) => (s.id === step.id ? { ...s, ...patch } : s));
      const rest = verlaufDerKette(aktualisiert).schritte.filter(
        (s) => s.status !== 'erledigt' && s.status !== 'uebersprungen',
      );
      if (rest.length === 0) {
        updateRun(run.id, { status: 'abgeschlossen' });
        toast('Alle Schritte erledigt – Planlauf abgeschlossen.');
        return;
      }
      if (rest[0].status === 'offen') updateStep(run.id, rest[0].id, { status: 'laufend' });
    }
    toast(`„${step.name}“: ${STEP_STATUS_LABEL[status]}`);
  };

  const waehleAntwort = (step: RunStep, antwortId: string) => {
    updateStep(run.id, step.id, { gewaehlteAntwortId: antwortId });
  };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <button type="button" className="btn btn-ghost" onClick={onZurueck}>
          <Icon name="zurueck" size={14} /> Übersicht
        </button>
        <div className="row">
          {run.status === 'laufend' ? (
            <button type="button" className="btn btn-outline" onClick={() => setAbbrechen(true)}>
              Planlauf abbrechen
            </button>
          ) : null}
          <button type="button" className="btn btn-danger" onClick={() => setLaufLoeschen(true)}>
            <Icon name="loeschen" size={14} /> Lauf löschen
          </button>
        </div>
      </div>

      {run.status === 'abgebrochen' ? (
        <Callout ton="error" icon="!">
          <strong>Planlauf abgebrochen{run.abbruchDatum ? ` am ${formatDate(run.abbruchDatum)}` : ''}.</strong>
          <div>{run.abbruchGrund || 'Ohne Begründung.'}</div>
        </Callout>
      ) : null}

      <Card>
        <CardHeader
          titel={run.name}
          sub={
            <>
              {doc ? `${doc.nummer} · ${doc.titel}${doc.index ? ` (Index ${doc.index})` : ''}` : 'ohne Plan'} · Start{' '}
              {formatDate(run.start)} · Vorlage: {run.templateName}
            </>
          }
          actions={<RunStatusBadge status={run.status} />}
        />
        <div className="card-pad">
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
            !beendet ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setNeuerSchritt(true)}>
                <Icon name="plus" size={13} /> Schritt einfügen
              </button>
            ) : null
          }
        />
        {verlauf.map((step, i) => {
          const ampel: Ampel = ampelFuerSchritt(step, vorlauf);
          const kontakt = data.contacts.find((c) => c.id === step.contactId);
          const istAktiv = step.id === aktiv?.id;
          const erledigt = step.status === 'erledigt' || step.status === 'uebersprungen';
          return (
            <div className={`step-row ${istAktiv && !beendet ? 'aktiv' : ''}`} key={step.id}>
              <div className="step-marker">
                <div
                  className={`step-num ${
                    ampel === 'erledigt' ? 'done' : ampel === 'ueberfaellig' ? 'late' : istAktiv ? 'current' : ''
                  }`}
                >
                  {erledigt ? <Icon name="check" size={12} strokeWidth={2.4} /> : i + 1}
                </div>
                {i < verlauf.length - 1 ? <div className="step-line" /> : null}
              </div>

              <div className="step-body">
                <div className="step-title">
                  <strong>{step.name}</strong>
                  <StepTypBadge typ={step.typ} />
                  {step.status === 'uebersprungen' ? <Badge>Übersprungen</Badge> : <AmpelBadge ampel={ampel} />}
                  {step.abweichung ? <Badge ton="orange">Abweichung</Badge> : null}
                  {(step.durchlauf ?? 1) > 1 ? <Badge ton="purple">{step.durchlauf}. Durchlauf</Badge> : null}
                </div>

                <div className="step-meta">
                  <span>
                    Verantwortlich: <b>{step.roleName || '–'}</b>
                  </span>
                  <span>
                    Person: <b>{kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : 'nicht zugeordnet'}</b>
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

                {step.typ === 'entscheidung' && step.antworten.length > 0 ? (
                  <div className="row wrap" style={{ gap: 6 }}>
                    <span className="small muted">Antwort:</span>
                    {step.antworten.map((a) => {
                      const gewaehlt = massgeblicheAntwort(step)?.id === a.id;
                      const gesetzt = step.gewaehlteAntwortId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          className={`antwort-chip ${gewaehlt ? 'gewaehlt' : ''}`}
                          onClick={() => waehleAntwort(step, a.id)}
                          disabled={beendet}
                          title={
                            a.ziel === 'ende'
                              ? 'beendet den Planlauf'
                              : a.ziel
                                ? `weiter mit „${run.steps.find((s) => s.id === a.ziel)?.name ?? '?'}“`
                                : 'weiter mit dem nächsten Schritt'
                          }
                        >
                          {a.text}
                          {gesetzt ? ' ✓' : ''}
                        </button>
                      );
                    })}
                    {!step.gewaehlteAntwortId ? (
                      <span className="small tertiary">(Vorschau: erste Möglichkeit)</span>
                    ) : null}
                  </div>
                ) : null}

                {step.bemerkung ? <p className="small tertiary">{step.bemerkung}</p> : null}

                {!beendet ? (
                  <div className="step-actions">
                    {!erledigt ? (
                      <>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => setzeStatus(step, 'erledigt')}>
                          <Icon name="check" size={13} /> Erledigt
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setzeStatus(step, 'uebersprungen')}>
                          Überspringen
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm" onClick={() => setzeStatus(step, 'laufend')}>
                        Wieder öffnen
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => setMailStep(step)}
                      disabled={erledigt}
                      title="Vorbereitete E-Mail an die zuständige Person"
                    >
                      <Icon name="mail" size={13} /> Erinnern
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setBearbeiten(step)}>
                      <Icon name="bearbeiten" size={13} /> Anpassen
                    </button>
                    {step.letzteErinnerung ? (
                      <span className="small tertiary">
                        erinnert am {new Date(step.letzteErinnerung).toLocaleDateString('de-DE')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {rueckSprungZu ? (
          <div className="step-row">
            <div className="step-marker">
              <div className="step-num" title="Rücksprung">↺</div>
            </div>
            <div className="step-body">
              <div className="step-title">
                <strong>Rücksprung zu „{rueckSprungZu.name}“</strong>
                <Badge ton="purple">Schleife</Badge>
              </div>
              <p className="small muted">
                Die gewählte Antwort führt zurück. Sobald die Entscheidung erledigt wird, beginnt ab diesem
                Schritt ein weiterer Durchlauf.
              </p>
            </div>
          </div>
        ) : null}

        {abseits.length > 0 ? (
          <div className="card-pad" style={{ borderTop: '1px solid var(--separator)' }}>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Nicht im aktuellen Verlauf – werden bei anderer Entscheidung durchlaufen:
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              {abseits.map((s) => (
                <span key={s.id} className="badge">
                  {s.name}
                  {s.roleName ? ` · ${s.roleName}` : ''}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {mailStep ? (
        <EmailDialog project={project} run={run} step={mailStep} onClose={() => setMailStep(null)} />
      ) : null}

      {bearbeiten ? (
        <SchrittDialog project={project} run={run} step={bearbeiten} onClose={() => setBearbeiten(null)} />
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
              antworten: [],
              gewaehlteAntwortId: null,
              durchlauf: 1,
            });
            toast('Schritt eingefügt – als Abweichung markiert.');
          }}
        />
      ) : null}

      {abbrechen ? (
        <AbbruchDialog
          run={run}
          onClose={() => setAbbrechen(false)}
          onAbbrechen={(grund) => {
            abbrechenRun(run.id, grund);
            toast('Planlauf abgebrochen – er bleibt in der Projektansicht sichtbar.');
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

/* ------------------------------------------------------------------ */

function AbbruchDialog({
  run,
  onClose,
  onAbbrechen,
}: {
  run: PlanRun;
  onClose: () => void;
  onAbbrechen: (grund: string) => void;
}) {
  const toast = useToast();
  const [grund, setGrund] = useState('');

  return (
    <Modal
      titel="Planlauf abbrechen"
      sub={run.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Zurück
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: 'var(--red)' }}
            onClick={() => {
              if (!grund.trim()) {
                toast('Bitte einen Grund angeben.');
                return;
              }
              onAbbrechen(grund.trim());
              onClose();
            }}
          >
            Planlauf abbrechen
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <Callout icon="i">
          Der Lauf bleibt ausgegraut in der Projektansicht mit dem Grund sichtbar. In den übergeordneten Ansichten
          (Übersicht, Fristen) erscheint er nicht mehr.
        </Callout>
        <Field label="Grund des Abbruchs" hint="wird in der Projektübersicht und im Export angezeigt">
          <TextArea
            value={grund}
            onChange={setGrund}
            rows={3}
            placeholder="z.B. Planinhalt entfällt, Leistung neu beauftragt …"
          />
        </Field>
      </div>
    </Modal>
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
    typ: step?.typ ?? ('aufgabe' as StepType),
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
        <Field label="Verantwortlicher">
          <Select
            value={form.roleName}
            onChange={(v) => set('roleName', v)}
            placeholder="– keine Rolle –"
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
