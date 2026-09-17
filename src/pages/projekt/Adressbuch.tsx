/**
 * Projektbezogenes Adressbuch. Je Kontakt lassen sich mehrere Funktionen
 * zuweisen; zur Auswahl stehen dabei nur die Funktionen, die im Reiter
 * „Funktionen“ für das gewählte Gewerk hinterlegt sind.
 */
import { useState } from 'react';
import {
  GEWERKE,
  UEBERGREIFEND,
  type Contact,
  type ID,
  type Project,
  type Role,
  type Zuordnung,
} from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { KontakteImport } from './KontakteImport';
import {
  Avatar,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Search,
  Select,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';

export function Adressbuch({ project }: { project: Project }) {
  const { data } = useStore();
  const [suche, setSuche] = useState('');
  const [kontaktDialog, setKontaktDialog] = useState<{ contact?: Contact } | null>(null);
  const [importOffen, setImportOffen] = useState(false);

  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const alleKontakte = data.contacts.filter((c) => c.projectId === project.id);
  const kontakte = alleKontakte
    .filter((c) => [c.vorname, c.nachname, c.firma, c.email].join(' ').toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));

  /** Funktion und Gewerk eines Kontakts als lesbare Angabe. */
  const zuordnungText = (c: Contact) =>
    c.zuordnungen
      .map((z) => {
        const rolle = rollen.find((r) => r.id === z.roleId);
        if (!rolle) return null;
        return { rolle, gewerk: z.gewerk };
      })
      .filter((x): x is { rolle: Role; gewerk: string | null } => Boolean(x));

  return (
    <div className="stack">
      <div className="row-between wrap">
        <Search value={suche} onChange={setSuche} placeholder="Name, Firma, E-Mail …" />
        <div className="row">
          <button type="button" className="btn btn-outline" onClick={() => setImportOffen(true)}>
            <Icon name="importieren" size={14} /> Excel-Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setKontaktDialog({})}>
            <Icon name="plus" size={14} /> Kontakt
          </button>
        </div>
      </div>

      <Card>
        <CardHeader titel="Kontakte" sub={`${kontakte.length} Einträge im Projekt`} />
        {kontakte.length === 0 ? (
          <EmptyState
            icon="adressbuch"
            titel="Noch keine Kontakte"
            text="Legen Sie Kontakte an oder lesen Sie eine Liste als Excel-Datei ein."
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <button type="button" className="btn btn-outline" onClick={() => setImportOffen(true)}>
                  <Icon name="importieren" size={14} /> Excel-Import
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setKontaktDialog({})}>
                  <Icon name="plus" size={14} /> Kontakt anlegen
                </button>
              </div>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="col-optional">Firma</th>
                  <th>Gewerk & Funktion</th>
                  <th>Kontakt</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {kontakte.map((c) => {
                  const meine = zuordnungText(c);
                  return (
                    <tr key={c.id} className="clickable" onClick={() => setKontaktDialog({ contact: c })}>
                      <td>
                        <span className="row">
                          <Avatar name={`${c.vorname} ${c.nachname}`} farbe={meine[0]?.rolle.farbe} />
                          <span>
                            <strong>
                              {c.vorname} {c.nachname}
                            </strong>
                            {c.eigen ? <span className="badge blue" style={{ marginLeft: 6 }}>Ich</span> : null}
                            {c.notiz ? <div className="small tertiary truncate">{c.notiz}</div> : null}
                          </span>
                        </span>
                      </td>
                      <td className="small muted col-optional">{c.firma}</td>
                      <td>
                        {meine.length === 0 ? (
                          <span className="tertiary small">keine Funktion</span>
                        ) : (
                          <span className="row wrap" style={{ gap: 5 }}>
                            {meine.map((m) => (
                              <span
                                key={`${m.rolle.id}-${m.gewerk ?? 'alle'}`}
                                className="role-chip"
                                style={{ color: m.rolle.farbe }}
                              >
                                {m.gewerk ? `${m.gewerk} · ` : ''}
                                {m.rolle.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="small">
                        <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
                          {c.email}
                        </a>
                        {c.telefon ? <div className="tertiary small">{c.telefon}</div> : null}
                        {c.anschrift ? (
                          <div className="tertiary small">{c.anschrift.replace(/\s*\n\s*/g, ', ')}</div>
                        ) : null}
                      </td>
                      <td className="actions">
                        <button type="button" className="btn-icon" aria-label="Bearbeiten">
                          <Icon name="bearbeiten" size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {kontaktDialog ? (
        <KontaktDialog
          project={project}
          rollen={rollen}
          contact={kontaktDialog.contact}
          onClose={() => setKontaktDialog(null)}
        />
      ) : null}

      {importOffen ? <KontakteImport project={project} onClose={() => setImportOffen(false)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function KontaktDialog({
  project,
  rollen,
  contact,
  onClose,
}: {
  project: Project;
  rollen: Role[];
  contact?: Contact;
  onClose: () => void;
}) {
  const { addContact, updateContact, deleteContact } = useStore();
  const toast = useToast();
  const [loeschen, setLoeschen] = useState(false);
  const [form, setForm] = useState({
    anrede: contact?.anrede ?? 'Frau',
    vorname: contact?.vorname ?? '',
    nachname: contact?.nachname ?? '',
    firma: contact?.firma ?? '',
    email: contact?.email ?? '',
    telefon: contact?.telefon ?? '',
    anschrift: contact?.anschrift ?? '',
    notiz: contact?.notiz ?? '',
  });

  // Mehrere Funktionen je Kontakt – jede mit ihrem Gewerk
  const [zuordnungen, setZuordnungen] = useState<Zuordnung[]>(contact?.zuordnungen ?? []);
  const [gewerk, setGewerk] = useState<string>(UEBERGREIFEND);
  const [roleId, setRoleId] = useState<ID>('');

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Gewerke aus den hinterlegten Funktionen, ergänzt um die vorgegebenen
  const gewerkeListe = [
    UEBERGREIFEND,
    ...[...new Set([...GEWERKE, ...rollen.map((r) => r.gewerk).filter((g): g is string => Boolean(g))])].sort(
      (a, b) => a.localeCompare(b, 'de'),
    ),
  ];

  /** Nur Funktionen des gewählten Gewerks, die noch nicht zugewiesen sind. */
  const moeglicheFunktionen = rollen.filter(
    (r) =>
      (gewerk === UEBERGREIFEND ? r.gewerk === null : r.gewerk === gewerk) &&
      !zuordnungen.some((z) => z.roleId === r.id),
  );

  const gewerkWechseln = (g: string) => {
    setGewerk(g);
    setRoleId('');
  };

  const funktionHinzufuegen = (id: ID) => {
    const rolle = rollen.find((r) => r.id === id);
    if (!rolle) return;
    setZuordnungen((z) => [...z, { roleId: rolle.id, gewerk: rolle.gewerk }]);
    setRoleId('');
  };

  const funktionEntfernen = (id: ID) => setZuordnungen((z) => z.filter((x) => x.roleId !== id));

  const speichern = () => {
    if (!form.nachname.trim()) {
      toast('Bitte einen Nachnamen angeben.');
      return;
    }
    if (contact) updateContact(contact.id, { ...form, zuordnungen });
    else addContact({ ...form, projectId: project.id, zuordnungen, eigen: false });
    toast(contact ? 'Kontakt aktualisiert.' : 'Kontakt angelegt.');
    onClose();
  };

  return (
    <>
      <Modal
        titel={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
        sub={contact?.eigen ? 'Eigener Eintrag – in markierten Projekten immer das Planlaufmanagement' : undefined}
        onClose={onClose}
        footer={
          <>
            {contact && !contact.eigen ? (
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
          <Field label="Funktionen" full hint="Mehrere Funktionen sind möglich – je Gewerk eine eigene.">
            {zuordnungen.length > 0 ? (
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                {zuordnungen.map((z) => {
                  const rolle = rollen.find((r) => r.id === z.roleId);
                  return (
                    <span key={z.roleId} className="role-chip" style={{ color: rolle?.farbe }}>
                      {z.gewerk ? `${z.gewerk} · ` : ''}
                      {rolle?.name ?? 'unbekannte Funktion'}
                      <button
                        type="button"
                        className="chip-weg"
                        aria-label="Funktion entfernen"
                        onClick={() => funktionEntfernen(z.roleId)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="small tertiary" style={{ marginBottom: 8 }}>
                Noch keine Funktion zugewiesen.
              </p>
            )}
            <div className="row wrap" style={{ gap: 8 }}>
              <Select
                value={gewerk}
                onChange={gewerkWechseln}
                options={gewerkeListe.map((g) => ({ value: g, label: g }))}
              />
              <Select
                value={roleId}
                onChange={funktionHinzufuegen}
                placeholder={
                  moeglicheFunktionen.length === 0 ? '– keine Funktion offen –' : '– Funktion hinzufügen –'
                }
                options={moeglicheFunktionen.map((r) => ({ value: r.id, label: r.name }))}
              />
            </div>
          </Field>
          <Field label="Anrede">
            <Select
              value={form.anrede}
              onChange={(v) => set('anrede', v)}
              options={[
                { value: 'Frau', label: 'Frau' },
                { value: 'Herr', label: 'Herr' },
                { value: '', label: 'ohne Anrede' },
              ]}
            />
          </Field>
          <Field label="Vorname">
            <TextInput value={form.vorname} onChange={(v) => set('vorname', v)} />
          </Field>
          <Field label="Nachname">
            <TextInput value={form.nachname} onChange={(v) => set('nachname', v)} />
          </Field>
          <Field label="Firma / Büro">
            <TextInput value={form.firma} onChange={(v) => set('firma', v)} />
          </Field>
          <Field label="E-Mail">
            <TextInput value={form.email} onChange={(v) => set('email', v)} type="email" />
          </Field>
          <Field label="Telefon">
            <TextInput value={form.telefon} onChange={(v) => set('telefon', v)} />
          </Field>
          <Field label="Anschrift" full hint="Straße, PLZ und Ort">
            <TextArea value={form.anschrift} onChange={(v) => set('anschrift', v)} rows={2} />
          </Field>
          <Field label="Notiz" full>
            <TextArea value={form.notiz} onChange={(v) => set('notiz', v)} rows={2} />
          </Field>
        </div>
      </Modal>

      {loeschen && contact ? (
        <ConfirmDialog
          titel="Kontakt löschen?"
          text={`„${contact.vorname} ${contact.nachname}“ wird aus dem Adressbuch entfernt und aus allen Prozessschritten ausgetragen.`}
          onConfirm={() => {
            deleteContact(contact.id);
            toast('Kontakt gelöscht.');
            onClose();
          }}
          onClose={() => setLoeschen(false)}
        />
      ) : null}
    </>
  );
}
