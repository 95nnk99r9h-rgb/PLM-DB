/** Projekteinstellungen: Fristenrechnung, Erinnerungen und E-Mail-Vorlagen. */
import { useState } from 'react';
import { EMAIL_ANLASS_LABEL, type EmailAnlass, type EmailTemplate, type Project } from '../../domain/types';
import { PLATZHALTER } from '../../domain/email';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { ProjektDialog } from '../Projekte';
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
import { Icon } from '../../components/icons';

export function Einstellungen({ project }: { project: Project }) {
  const { updateProject, deleteProject } = useStore();
  const toast = useToast();
  const [vorlage, setVorlage] = useState<{ template?: EmailTemplate } | null>(null);
  const [projektDialog, setProjektDialog] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [neuerFeiertag, setNeuerFeiertag] = useState('');

  const s = project.settings;
  const setSettings = (patch: Partial<typeof s>) => updateProject(project.id, { settings: { ...s, ...patch } });

  const vorlageSpeichern = (t: EmailTemplate) => {
    const vorhanden = s.emailTemplates.some((x) => x.id === t.id);
    setSettings({
      emailTemplates: vorhanden ? s.emailTemplates.map((x) => (x.id === t.id ? t : x)) : [...s.emailTemplates, t],
    });
    toast(vorhanden ? 'Vorlage gespeichert.' : 'Vorlage angelegt.');
  };

  return (
    <div className="stack">
      <Card>
        <CardHeader
          titel="Projektdaten"
          sub="Grunddaten des Projekts"
          actions={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setProjektDialog(true)}>
              <Icon name="bearbeiten" size={13} /> Bearbeiten
            </button>
          }
        />
        <div className="card-pad">
          <dl className="kv">
            <dt>Projektnummer</dt>
            <dd className="mono">{project.nummer || '–'}</dd>
            <dt>Beschreibung</dt>
            <dd>{project.beschreibung || '–'}</dd>
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader titel="Fristen & Erinnerungen" sub="Grundlage der Soll-Termin-Berechnung" />
        <div className="card-pad">
          <div className="form-grid">
            <Field label="Vorlaufzeit für Erinnerungen (Tage)" hint="Ab wann ein Schritt als „fällig“ gemeldet wird.">
              <TextInput
                value={String(s.erinnerungVorlaufTage)}
                onChange={(v) => setSettings({ erinnerungVorlaufTage: Number(v.replace(/\D/g, '')) || 0 })}
                inputMode="numeric"
              />
            </Field>
            <Field label="Fristenrechnung">
              <label className="checkbox" style={{ paddingTop: 7 }}>
                <input
                  type="checkbox"
                  checked={s.fristenInArbeitstagen}
                  onChange={(e) => setSettings({ fristenInArbeitstagen: e.target.checked })}
                />
                In Arbeitstagen rechnen (Mo–Fr, ohne Feiertage)
              </label>
            </Field>
            <Field label="Absendername" hint="wird als {{absender}} in E-Mails eingesetzt">
              <TextInput value={s.absenderName} onChange={(v) => setSettings({ absenderName: v })} />
            </Field>
            <Field label="Absender-E-Mail">
              <TextInput value={s.absenderEmail} onChange={(v) => setSettings({ absenderEmail: v })} type="email" />
            </Field>
            <Field label="Feiertage" full hint="Werden bei der Fristenrechnung in Arbeitstagen übersprungen.">
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                {s.feiertage.length === 0 ? <span className="tertiary small">keine hinterlegt</span> : null}
                {s.feiertage.map((f) => (
                  <span key={f} className="badge">
                    {new Date(f).toLocaleDateString('de-DE')}
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ padding: 0, marginLeft: 2 }}
                      onClick={() => setSettings({ feiertage: s.feiertage.filter((x) => x !== f) })}
                      aria-label="Feiertag entfernen"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="row">
                <TextInput value={neuerFeiertag} onChange={setNeuerFeiertag} type="date" />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (!neuerFeiertag || s.feiertage.includes(neuerFeiertag)) return;
                    setSettings({ feiertage: [...s.feiertage, neuerFeiertag].sort() });
                    setNeuerFeiertag('');
                  }}
                >
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          titel="E-Mail-Vorlagen"
          sub="Grundlage der vorbereiteten Erinnerungen je Prozessschritt"
          actions={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setVorlage({})}>
              <Icon name="plus" size={13} /> Vorlage
            </button>
          }
        />
        {s.emailTemplates.map((t) => (
          <div className="list-row" key={t.id}>
            <span className="tertiary" style={{ display: 'flex' }}>
              <Icon name="mail" size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <strong>{t.name}</strong>
                <Badge ton={t.anlass === 'ueberfaellig' ? 'red' : t.anlass === 'erinnerung' ? 'orange' : 'blue'}>
                  {EMAIL_ANLASS_LABEL[t.anlass]}
                </Badge>
              </div>
              <div className="small tertiary truncate">{t.betreff}</div>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setVorlage({ template: t })}>
              Bearbeiten
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setSettings({ emailTemplates: s.emailTemplates.filter((x) => x.id !== t.id) });
                toast('Vorlage gelöscht.');
              }}
              aria-label="Vorlage löschen"
            >
              <Icon name="loeschen" size={15} />
            </button>
          </div>
        ))}
        {s.emailTemplates.length === 0 ? (
          <div className="card-pad">
            <Callout ton="warn" icon="!">
              Ohne Vorlage kann keine Erinnerungs-E-Mail vorbereitet werden.
            </Callout>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader titel="Projekt löschen" sub="Entfernt Pläne, Adressbuch und Planläufe dauerhaft" />
        <div className="card-pad">
          <button type="button" className="btn btn-danger" onClick={() => setLoeschen(true)}>
            <Icon name="loeschen" size={14} /> Projekt löschen
          </button>
        </div>
      </Card>

      {vorlage ? (
        <VorlagenDialog template={vorlage.template} onSpeichern={vorlageSpeichern} onClose={() => setVorlage(null)} />
      ) : null}
      {projektDialog ? <ProjektDialog project={project} onClose={() => setProjektDialog(false)} /> : null}
      {loeschen ? (
        <ConfirmDialog
          titel="Projekt löschen?"
          text={`„${project.name}“ wird mit allen Plänen, Kontakten und Planläufen gelöscht.`}
          onConfirm={() => {
            deleteProject(project.id);
            toast('Projekt gelöscht.');
            window.location.hash = '#/projekte';
          }}
          onClose={() => setLoeschen(false)}
        />
      ) : null}
    </div>
  );
}

function VorlagenDialog({
  template,
  onSpeichern,
  onClose,
}: {
  template?: EmailTemplate;
  onSpeichern: (t: EmailTemplate) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<EmailTemplate>(
    template ?? {
      id: newId('mail'),
      name: '',
      anlass: 'erinnerung',
      betreff: '[{{projekt.nummer}}] {{schritt}} – {{plan.nummer}}',
      text: `{{anrede}}

…

Mit freundlichen Grüßen
{{absender}}`,
    },
  );

  const einfuegen = (schluessel: string) => {
    setForm((f) => ({ ...f, text: `${f.text}{{${schluessel}}}` }));
  };

  return (
    <Modal
      titel={template ? 'E-Mail-Vorlage bearbeiten' : 'Neue E-Mail-Vorlage'}
      sub="Platzhalter in doppelten geschweiften Klammern werden beim Versand ersetzt"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!form.name.trim()) {
                toast('Bitte einen Namen angeben.');
                return;
              }
              onSpeichern(form);
              onClose();
            }}
          >
            Speichern
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="form-grid">
          <Field label="Name der Vorlage">
            <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          </Field>
          <Field label="Anlass" hint="Bestimmt, welche Vorlage automatisch vorgeschlagen wird.">
            <Select
              value={form.anlass}
              onChange={(v) => setForm({ ...form, anlass: v as EmailAnlass })}
              options={Object.entries(EMAIL_ANLASS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Betreff" full>
            <TextInput value={form.betreff} onChange={(v) => setForm({ ...form, betreff: v })} />
          </Field>
          <Field label="Text" full>
            <TextArea value={form.text} onChange={(v) => setForm({ ...form, text: v })} rows={14} />
          </Field>
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>Platzhalter einfügen</h3>
          <div className="row wrap" style={{ gap: 6 }}>
            {PLATZHALTER.map((p) => (
              <button
                key={p.schluessel}
                type="button"
                className="badge"
                style={{ cursor: 'pointer', border: 'none' }}
                title={p.beschreibung}
                onClick={() => einfuegen(p.schluessel)}
              >
                {`{{${p.schluessel}}}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
