/**
 * Verwaltung der Prozessketten-Vorlagen: Standardketten, projektspezifische
 * Varianten und der Import von BPMN-2.0-Diagrammen.
 */
import { useRef, useState } from 'react';
import { parseBpmn, templateAusImport } from '../domain/bpmn';
import { templateDauer } from '../domain/engine';
import { STEP_TYPE_LABEL, type ProcessTemplate, type ProcessTemplateStep, type StepType } from '../domain/types';
import { newId, useStore } from '../store/store';
import { useToast } from '../components/toast';
import { StepTypBadge } from '../components/common';
import {
  Badge,
  Callout,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Select,
  TextArea,
  TextInput,
} from '../components/ui';
import { Icon } from '../components/icons';

export function Prozessketten({ projectId }: { projectId?: string }) {
  const { data, addTemplate, deleteTemplate } = useStore();
  const toast = useToast();
  const [editor, setEditor] = useState<{ template?: ProcessTemplate } | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [loeschen, setLoeschen] = useState<ProcessTemplate | null>(null);

  const vorlagen = data.templates.filter((t) => (projectId ? t.projectId === null || t.projectId === projectId : true));
  const standard = vorlagen.filter((t) => t.projectId === null);
  const eigene = vorlagen.filter((t) => t.projectId !== null);

  const duplizieren = (t: ProcessTemplate) => {
    addTemplate({
      ...t,
      id: newId('tpl'),
      projectId: projectId ?? null,
      name: `${t.name} (Kopie)`,
      herkunft: 'manuell',
      steps: t.steps.map((s) => ({ ...s, id: newId('ts') })),
    });
    toast('Prozesskette dupliziert – jetzt individuell anpassbar.');
  };

  const liste = (titel: string, eintraege: ProcessTemplate[], sub: string) => (
    <Card>
      <CardHeader titel={titel} sub={sub} />
      {eintraege.length === 0 ? (
        <EmptyState icon="kette" titel="Keine Prozesskette" text="Importieren Sie ein BPMN-Diagramm oder legen Sie eine Kette an." />
      ) : (
        eintraege.map((t) => (
          <div className="list-row" key={t.id}>
            <span className="tertiary" style={{ display: 'flex' }}>
              <Icon name="kette" size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <strong>{t.name}</strong>
                {t.herkunft === 'bpmn' ? <Badge ton="purple">BPMN 2.0</Badge> : null}
                {t.projectId === null ? <Badge>Standard</Badge> : <Badge ton="blue">Projektvariante</Badge>}
              </div>
              <div className="small tertiary truncate">
                {t.steps.length} Schritte · {templateDauer(t)} Tage Gesamtdauer
                {t.beschreibung ? ` · ${t.beschreibung}` : ''}
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditor({ template: t })}>
              Öffnen
            </button>
            <button type="button" className="btn btn-sm" onClick={() => duplizieren(t)}>
              <Icon name="kopieren" size={13} /> Duplizieren
            </button>
            {t.projectId !== null ? (
              <button type="button" className="btn-icon" onClick={() => setLoeschen(t)} aria-label="Löschen">
                <Icon name="loeschen" size={15} />
              </button>
            ) : null}
          </div>
        ))
      )}
    </Card>
  );

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="muted small" style={{ maxWidth: 620 }}>
          Standardketten gelten projektübergreifend. Für Abweichungen duplizieren Sie eine Kette als Projektvariante –
          einzelne Planläufe lassen sich zusätzlich individuell anpassen.
        </p>
        <div className="row">
          <button type="button" className="btn btn-outline" onClick={() => setImportDialog(true)}>
            <Icon name="importieren" size={14} /> BPMN 2.0 importieren
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditor({})}>
            <Icon name="plus" size={14} /> Neue Kette
          </button>
        </div>
      </div>

      {liste('Standard-Prozessketten', standard, 'Projektübergreifend verfügbar')}
      {liste(projectId ? 'Projektvarianten' : 'Projektspezifische Ketten', eigene, 'Nur im jeweiligen Projekt wählbar')}

      {editor ? (
        <KettenEditor template={editor.template} projectId={projectId ?? null} onClose={() => setEditor(null)} />
      ) : null}
      {importDialog ? <BpmnImport projectId={projectId ?? null} onClose={() => setImportDialog(false)} /> : null}
      {loeschen ? (
        <ConfirmDialog
          titel="Prozesskette löschen?"
          text={`„${loeschen.name}“ wird gelöscht. Bereits gestartete Planläufe bleiben unverändert.`}
          onConfirm={() => {
            deleteTemplate(loeschen.id);
            toast('Prozesskette gelöscht.');
          }}
          onClose={() => setLoeschen(null)}
        />
      ) : null}
    </div>
  );
}

function KettenEditor({
  template,
  projectId,
  onClose,
}: {
  template?: ProcessTemplate;
  projectId: string | null;
  onClose: () => void;
}) {
  const { data, addTemplate, updateTemplate } = useStore();
  const toast = useToast();
  const rollen = [...new Set(data.roles.map((r) => r.name))];

  const [name, setName] = useState(template?.name ?? '');
  const [beschreibung, setBeschreibung] = useState(template?.beschreibung ?? '');
  const [steps, setSteps] = useState<ProcessTemplateStep[]>(
    template?.steps.map((s) => ({ ...s })) ?? [
      { id: newId('ts'), name: 'Planerstellung', typ: 'task', roleName: '', fristTage: 10, beschreibung: '' },
    ],
  );

  const istStandard = template?.projectId === null && template !== undefined;

  const setStep = (id: string, patch: Partial<ProcessTemplateStep>) =>
    setSteps((alt) => alt.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const verschieben = (idx: number, richtung: -1 | 1) => {
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= steps.length) return;
    const neu = [...steps];
    [neu[idx], neu[ziel]] = [neu[ziel], neu[idx]];
    setSteps(neu);
  };

  const speichern = () => {
    if (!name.trim()) {
      toast('Bitte einen Namen angeben.');
      return;
    }
    if (template) {
      updateTemplate(template.id, { name, beschreibung, steps });
      toast('Prozesskette gespeichert.');
    } else {
      addTemplate({ projectId, name, beschreibung, herkunft: 'manuell', steps });
      toast('Prozesskette angelegt.');
    }
    onClose();
  };

  return (
    <Modal
      titel={template ? 'Prozesskette bearbeiten' : 'Neue Prozesskette'}
      sub={`${steps.length} Schritte · Gesamtdauer ${steps.reduce((s, x) => s + x.fristTage, 0)} Tage`}
      wide
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
      <div className="stack" style={{ gap: 16 }}>
        {istStandard ? (
          <Callout icon="ℹ︎">
            Dies ist eine projektübergreifende Standardkette. Änderungen wirken sich auf alle künftigen Planläufe aus –
            für einmalige Abweichungen besser duplizieren.
          </Callout>
        ) : null}

        <div className="form-grid">
          <Field label="Name" full>
            <TextInput value={name} onChange={setName} placeholder="z.B. Planlauf Ausführungsplanung" />
          </Field>
          <Field label="Beschreibung" full>
            <TextArea value={beschreibung} onChange={setBeschreibung} rows={2} />
          </Field>
        </div>

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>Schritt</th>
                <th style={{ width: 130 }}>Art</th>
                <th style={{ width: 170 }}>Rolle</th>
                <th style={{ width: 90 }}>Frist (T)</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.id}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <input className="input" value={s.name} onChange={(e) => setStep(s.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <select
                      className="select"
                      value={s.typ}
                      onChange={(e) => setStep(s.id, { typ: e.target.value as StepType })}
                    >
                      {Object.entries(STEP_TYPE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input"
                      value={s.roleName}
                      list="rollen-liste"
                      placeholder="Rolle"
                      onChange={(e) => setStep(s.id, { roleName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={s.fristTage}
                      inputMode="numeric"
                      onChange={(e) => setStep(s.id, { fristTage: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    />
                  </td>
                  <td className="actions">
                    <button type="button" className="btn-icon" onClick={() => verschieben(i, -1)} disabled={i === 0} aria-label="Nach oben">
                      <Icon name="hoch" size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => verschieben(i, 1)}
                      disabled={i === steps.length - 1}
                      aria-label="Nach unten"
                    >
                      <Icon name="runter" size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setSteps((alt) => alt.filter((x) => x.id !== s.id))}
                      aria-label="Entfernen"
                    >
                      <Icon name="loeschen" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="rollen-liste">
            {rollen.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <div className="card-pad">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() =>
                setSteps((alt) => [
                  ...alt,
                  { id: newId('ts'), name: 'Neuer Schritt', typ: 'task', roleName: '', fristTage: 5, beschreibung: '' },
                ])
              }
            >
              <Icon name="plus" size={13} /> Schritt hinzufügen
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BpmnImport({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const { addTemplate } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fehler, setFehler] = useState('');
  const [ergebnis, setErgebnis] = useState<{ name: string; steps: ProcessTemplateStep[]; warnungen: string[]; datei: string } | null>(null);

  const lies = async (datei: File) => {
    setFehler('');
    try {
      const xml = await datei.text();
      const res = parseBpmn(xml, datei.name);
      setErgebnis({ ...res, datei: datei.name });
    } catch (e) {
      setErgebnis(null);
      setFehler(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const uebernehmen = () => {
    if (!ergebnis) return;
    addTemplate(
      templateAusImport(
        { name: ergebnis.name, steps: ergebnis.steps, warnungen: ergebnis.warnungen },
        newId('tpl'),
        projectId,
        ergebnis.datei,
      ),
    );
    toast(`Prozesskette „${ergebnis.name}“ importiert.`);
    onClose();
  };

  return (
    <Modal
      titel="BPMN-2.0-Diagramm importieren"
      sub="Aufgaben, Lanes (Rollen) und hinterlegte Fristen werden übernommen"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={uebernehmen} disabled={!ergebnis}>
            Als Prozesskette übernehmen
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div
          className={`drop-zone ${over ? 'over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const datei = e.dataTransfer.files[0];
            if (datei) void lies(datei);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="importieren" size={26} strokeWidth={1.4} />
          </div>
          {ergebnis ? (
            <>
              <strong>{ergebnis.datei}</strong>
              <div className="small">Andere Datei wählen</div>
            </>
          ) : (
            <>
              <strong>.bpmn- oder .xml-Datei hierher ziehen</strong>
              <div className="small">oder klicken, um eine Datei auszuwählen</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".bpmn,.xml,application/xml,text/xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const datei = e.target.files?.[0];
              if (datei) void lies(datei);
            }}
          />
        </div>

        {fehler ? (
          <Callout ton="error" icon="!">
            {fehler}
          </Callout>
        ) : null}

        {ergebnis ? (
          <>
            <div className="form-grid">
              <Field label="Name der Prozesskette" full>
                <TextInput value={ergebnis.name} onChange={(v) => setErgebnis({ ...ergebnis, name: v })} />
              </Field>
            </div>

            {ergebnis.warnungen.length > 0 ? (
              <Callout ton="warn" icon="!">
                <strong>Hinweise zum Import:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {ergebnis.warnungen.slice(0, 6).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Schritt</th>
                    <th>Art</th>
                    <th style={{ width: 170 }}>Rolle (Lane)</th>
                    <th style={{ width: 110 }}>Frist (Tage)</th>
                  </tr>
                </thead>
                <tbody>
                  {ergebnis.steps.map((s, i) => (
                    <tr key={s.id}>
                      <td className="num">{i + 1}</td>
                      <td>{s.name}</td>
                      <td><StepTypBadge typ={s.typ} /></td>
                      <td>
                        <input
                          className="input"
                          value={s.roleName}
                          placeholder="Rolle ergänzen"
                          onChange={(e) =>
                            setErgebnis({
                              ...ergebnis,
                              steps: ergebnis.steps.map((x) => (x.id === s.id ? { ...x, roleName: e.target.value } : x)),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={s.fristTage}
                          inputMode="numeric"
                          onChange={(e) =>
                            setErgebnis({
                              ...ergebnis,
                              steps: ergebnis.steps.map((x) =>
                                x.id === s.id ? { ...x, fristTage: Number(e.target.value.replace(/\D/g, '')) || 0 } : x,
                              ),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <Callout icon="ℹ︎">
            Fristen werden aus Attributen wie <code>frist="5"</code>, aus Extension-Properties oder aus
            ISO-8601-Dauern (<code>P5D</code>) gelesen. Fehlt eine Angabe, werden 5 Tage angenommen – anpassbar direkt
            nach dem Import.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

/** Auswahlfeld für Rollen, wird im Editor als Datalist genutzt. */
export function RollenSelect({
  value,
  onChange,
  rollen,
}: {
  value: string;
  onChange: (v: string) => void;
  rollen: string[];
}) {
  return <Select value={value} onChange={onChange} options={rollen.map((r) => ({ value: r, label: r }))} placeholder="– keine –" />;
}
