/** Projektbezogenes Adressbuch mit frei definierbaren Rollen. */
import { useState } from 'react';
import type { Contact, ID, Project, Role } from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { RollenChips } from '../../components/common';
import {
  Avatar,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Search,
  TextArea,
  TextInput,
} from '../../components/ui';
import { Icon } from '../../components/icons';

const FARBEN = ['#0071e3', '#5856d6', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#00a0a0', '#c77700'];

export function Adressbuch({ project }: { project: Project }) {
  const { data } = useStore();
  const [suche, setSuche] = useState('');
  const [kontaktDialog, setKontaktDialog] = useState<{ contact?: Contact } | null>(null);
  const [rollenDialog, setRollenDialog] = useState(false);

  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const kontakte = data.contacts
    .filter((c) => c.projectId === project.id)
    .filter((c) =>
      [c.vorname, c.nachname, c.firma, c.email].join(' ').toLowerCase().includes(suche.toLowerCase()),
    )
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));

  return (
    <div className="stack">
      <div className="row-between wrap">
        <Search value={suche} onChange={setSuche} placeholder="Name, Firma, E-Mail …" />
        <div className="row">
          <button type="button" className="btn btn-outline" onClick={() => setRollenDialog(true)}>
            <Icon name="person" size={14} /> Rollen verwalten ({rollen.length})
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
            text="Kontakte werden Prozessschritten als Zuständige zugeordnet."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setKontaktDialog({})}>
                <Icon name="plus" size={14} /> Kontakt anlegen
              </button>
            }
          />
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th className="col-optional">Firma</th>
                <th className="col-optional">Rollen</th>
                <th>Kontakt</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody>
              {kontakte.map((c) => {
                const meine = rollen.filter((r) => c.roleIds.includes(r.id));
                return (
                  <tr key={c.id} className="clickable" onClick={() => setKontaktDialog({ contact: c })}>
                    <td>
                      <span className="row">
                        <Avatar name={`${c.vorname} ${c.nachname}`} farbe={meine[0]?.farbe} />
                        <span>
                          <strong>
                            {c.vorname} {c.nachname}
                          </strong>
                          {c.notiz ? <div className="small tertiary truncate">{c.notiz}</div> : null}
                        </span>
                      </span>
                    </td>
                    <td className="small muted col-optional">{c.firma}</td>
                    <td className="col-optional"><RollenChips roles={meine} /></td>
                    <td className="small">
                      <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
                        {c.email}
                      </a>
                      {c.telefon ? <div className="tertiary small">{c.telefon}</div> : null}
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
          </table></div>
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
      {rollenDialog ? (
        <RollenDialog project={project} rollen={rollen} onClose={() => setRollenDialog(false)} />
      ) : null}
    </div>
  );
}

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
    roleIds: contact?.roleIds ?? ([] as ID[]),
    notiz: contact?.notiz ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRolle = (id: ID) =>
    set('roleIds', form.roleIds.includes(id) ? form.roleIds.filter((r) => r !== id) : [...form.roleIds, id]);

  const speichern = () => {
    if (!form.nachname.trim()) {
      toast('Bitte einen Nachnamen angeben.');
      return;
    }
    if (contact) updateContact(contact.id, form);
    else addContact({ ...form, projectId: project.id });
    toast(contact ? 'Kontakt aktualisiert.' : 'Kontakt angelegt.');
    onClose();
  };

  return (
    <>
      <Modal
        titel={contact ? 'Kontakt bearbeiten' : 'Neuer Kontakt'}
        onClose={onClose}
        footer={
          <>
            {contact ? (
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
          <Field label="Anrede">
            <TextInput value={form.anrede} onChange={(v) => set('anrede', v)} placeholder="Frau / Herr" />
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
          <Field label="Rollen im Projekt" full hint="Bestimmt, welche Prozessschritte automatisch zugeordnet werden.">
            <div className="row wrap" style={{ gap: 6 }}>
              {rollen.length === 0 ? <span className="tertiary small">Noch keine Rollen angelegt.</span> : null}
              {rollen.map((r) => {
                const aktiv = form.roleIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="role-chip"
                    onClick={() => toggleRolle(r.id)}
                    style={{
                      color: aktiv ? '#fff' : r.farbe,
                      background: aktiv ? r.farbe : 'transparent',
                      borderColor: r.farbe,
                      cursor: 'pointer',
                      padding: '4px 11px',
                    }}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
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

function RollenDialog({ project, rollen, onClose }: { project: Project; rollen: Role[]; onClose: () => void }) {
  const { addRole, updateRole, deleteRole } = useStore();
  const toast = useToast();
  const [neu, setNeu] = useState('');

  const anlegen = () => {
    const name = neu.trim();
    if (!name) return;
    addRole({
      projectId: project.id,
      name,
      kuerzel: name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
      farbe: FARBEN[rollen.length % FARBEN.length],
      beschreibung: '',
    });
    setNeu('');
    toast('Rolle angelegt.');
  };

  return (
    <Modal
      titel="Rollen im Projekt"
      sub="Rollen verbinden Prozessschritte mit Personen aus dem Adressbuch"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Fertig
        </button>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <div className="row">
          <TextInput
            value={neu}
            onChange={setNeu}
            placeholder="Neue Rolle, z.B. Prüfstatiker"
            onKeyDown={(e) => e.key === 'Enter' && anlegen()}
          />
          <button type="button" className="btn btn-primary" onClick={anlegen}>
            <Icon name="plus" size={14} />
          </button>
        </div>

        <div className="card">
          {rollen.length === 0 ? (
            <EmptyState icon="person" titel="Keine Rollen" text="Legen Sie oben die erste Rolle an." />
          ) : (
            rollen.map((r) => (
              <div className="list-row" key={r.id}>
                <input
                  type="color"
                  value={r.farbe}
                  onChange={(e) => updateRole(r.id, { farbe: e.target.value })}
                  style={{ width: 26, height: 26, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  title="Farbe"
                />
                <input
                  className="input"
                  value={r.name}
                  onChange={(e) => updateRole(r.id, { name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <input
                  className="input"
                  value={r.kuerzel}
                  onChange={(e) => updateRole(r.id, { kuerzel: e.target.value })}
                  style={{ width: 76 }}
                  title="Kürzel"
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => {
                    deleteRole(r.id);
                    toast('Rolle gelöscht.');
                  }}
                  aria-label="Rolle löschen"
                >
                  <Icon name="loeschen" size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
