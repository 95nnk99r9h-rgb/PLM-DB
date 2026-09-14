/**
 * Projektbezogenes Adressbuch: Rollen des Projekts mit den ihnen zugewiesenen
 * Personen sowie die Kontakte selbst.
 */
import { useState } from 'react';
import {
  GEWERKBEZUG_LABEL,
  GEWERKE,
  type Contact,
  type ID,
  type Project,
  type Role,
} from '../../domain/types';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { Badge } from '../../components/ui';
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

const FARBEN = ['#0071e3', '#5856d6', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#00a0a0', '#c77700'];

export function Adressbuch({ project }: { project: Project }) {
  const { data, updateContact, updateRole, deleteRole } = useStore();
  const toast = useToast();
  const [suche, setSuche] = useState('');
  const [kontaktDialog, setKontaktDialog] = useState<{ contact?: Contact } | null>(null);
  const [rolleErgaenzen, setRolleErgaenzen] = useState(false);
  const [rolleLoeschen, setRolleLoeschen] = useState<Role | null>(null);

  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const alleKontakte = data.contacts.filter((c) => c.projectId === project.id);
  const kontakte = alleKontakte
    .filter((c) => [c.vorname, c.nachname, c.firma, c.email].join(' ').toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));

  /** Gewerke, die im Projekt vorkommen – Grundlage der Besetzung je Gewerk. */
  const projektGewerke = [
    ...new Set([
      ...data.documents.filter((d) => d.projectId === project.id).map((d) => d.gewerk),
      ...alleKontakte.flatMap((c) => c.zuordnungen.map((z) => z.gewerk ?? '')),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'de'));

  const gewerkAuswahl = projektGewerke.length > 0 ? projektGewerke : [...GEWERKE];

  /** Besetzt eine Rolle (ggf. für ein Gewerk) mit einer Person. */
  const zuweisen = (rolle: Role, contactId: ID, gewerk: string | null) => {
    const kontakt = alleKontakte.find((c) => c.id === contactId);
    if (!kontakt) return;
    if (kontakt.zuordnungen.some((z) => z.roleId === rolle.id && z.gewerk === gewerk)) return;
    updateContact(kontakt.id, { zuordnungen: [...kontakt.zuordnungen, { roleId: rolle.id, gewerk }] });
    toast(
      gewerk
        ? `${kontakt.vorname} ${kontakt.nachname} ist „${rolle.name}“ für ${gewerk}.`
        : `${kontakt.vorname} ${kontakt.nachname} ist „${rolle.name}“.`,
    );
  };

  const entfernen = (rolle: Role, kontakt: Contact, gewerk: string | null) => {
    updateContact(kontakt.id, {
      zuordnungen: kontakt.zuordnungen.filter((z) => !(z.roleId === rolle.id && z.gewerk === gewerk)),
    });
    toast(`${kontakt.vorname} ${kontakt.nachname} aus „${rolle.name}“ entfernt.`);
  };

  return (
    <div className="stack">
      <Card>
        <CardHeader
          titel="Rollen im Projekt"
          sub="Bestimmen, wer welche Prozessschritte verantwortet"
          actions={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setRolleErgaenzen(true)}>
              <Icon name="plus" size={13} /> Rolle ergänzen
            </button>
          }
        />
        {rollen.length === 0 ? (
          <EmptyState
            icon="person"
            titel="Keine Rollen im Projekt"
            text="Ergänzen Sie Rollen aus den Standardrollen oder legen Sie eigene an."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setRolleErgaenzen(true)}>
                <Icon name="plus" size={14} /> Rolle ergänzen
              </button>
            }
          />
        ) : (
          rollen.map((rolle) => {
            const besetzungen = alleKontakte.flatMap((c) =>
              c.zuordnungen.filter((z) => z.roleId === rolle.id).map((z) => ({ kontakt: c, gewerk: z.gewerk })),
            );
            const jeGewerk = rolle.gewerkBezug === 'individuell';
            return (
              <div className="list-row" key={rolle.id} style={{ alignItems: 'flex-start' }}>
                <input
                  type="color"
                  value={rolle.farbe}
                  onChange={(e) => updateRole(rolle.id, { farbe: e.target.value })}
                  style={{ width: 24, height: 24, border: 'none', background: 'none', padding: 0, cursor: 'pointer', marginTop: 3 }}
                  title="Farbe"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <input
                      className="input"
                      style={{ width: 200 }}
                      value={rolle.name}
                      onChange={(e) => updateRole(rolle.id, { name: e.target.value })}
                    />
                    <input
                      className="input"
                      style={{ width: 76 }}
                      value={rolle.kuerzel}
                      title="Kürzel"
                      onChange={(e) => updateRole(rolle.id, { kuerzel: e.target.value })}
                    />
                    <Badge ton={jeGewerk ? 'orange' : 'blue'}>{GEWERKBEZUG_LABEL[rolle.gewerkBezug]}</Badge>
                  </div>

                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                    {besetzungen.length === 0 ? (
                      <span className="small tertiary">niemand zugewiesen</span>
                    ) : (
                      besetzungen.map(({ kontakt, gewerk }) => (
                        <span key={`${kontakt.id}-${gewerk ?? 'alle'}`} className="role-chip" style={{ color: rolle.farbe }}>
                          {gewerk ? <b>{gewerk}</b> : null} {kontakt.vorname} {kontakt.nachname}
                          <button
                            type="button"
                            className="btn-icon"
                            style={{ padding: 0, marginLeft: 2, color: 'inherit' }}
                            aria-label="Zuweisung entfernen"
                            onClick={() => entfernen(rolle, kontakt, gewerk)}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  {jeGewerk ? (
                    <select className="select" style={{ width: 110 }} defaultValue={gewerkAuswahl[0]} id={`gw-${rolle.id}`}>
                      {gewerkAuswahl.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <select
                    className="select"
                    style={{ width: 180 }}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const gewerk = jeGewerk
                        ? (document.getElementById(`gw-${rolle.id}`) as HTMLSelectElement | null)?.value ?? null
                        : null;
                      zuweisen(rolle, e.target.value, gewerk);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Person zuweisen …</option>
                    {alleKontakte.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.vorname} {c.nachname}
                        {c.firma ? ` (${c.firma})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Rolle entfernen"
                    onClick={() => setRolleLoeschen(rolle)}
                  >
                    <Icon name="loeschen" size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <div className="row-between wrap">
        <Search value={suche} onChange={setSuche} placeholder="Name, Firma, E-Mail …" />
        <button type="button" className="btn btn-primary" onClick={() => setKontaktDialog({})}>
          <Icon name="plus" size={14} /> Kontakt
        </button>
      </div>

      <Card>
        <CardHeader titel="Kontakte" sub={`${kontakte.length} Einträge im Projekt`} />
        {kontakte.length === 0 ? (
          <EmptyState
            icon="adressbuch"
            titel="Noch keine Kontakte"
            text="Kontakte werden über ihre Rollen den Prozessschritten zugeordnet."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setKontaktDialog({})}>
                <Icon name="plus" size={14} /> Kontakt anlegen
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
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
                  const meine = c.zuordnungen
                    .map((z) => ({ rolle: rollen.find((r) => r.id === z.roleId), gewerk: z.gewerk }))
                    .filter((x): x is { rolle: Role; gewerk: string | null } => Boolean(x.rolle));
                  return (
                    <tr key={c.id} className="clickable" onClick={() => setKontaktDialog({ contact: c })}>
                      <td>
                        <span className="row">
                          <Avatar name={`${c.vorname} ${c.nachname}`} farbe={meine[0]?.rolle.farbe} />
                          <span>
                            <strong>
                              {c.vorname} {c.nachname}
                            </strong>
                            {c.notiz ? <div className="small tertiary truncate">{c.notiz}</div> : null}
                          </span>
                        </span>
                      </td>
                      <td className="small muted col-optional">{c.firma}</td>
                      <td className="col-optional">
                        {meine.length === 0 ? (
                          <span className="tertiary small">keine Rolle</span>
                        ) : (
                          <span className="row wrap" style={{ gap: 5 }}>
                            {meine.map((m) => (
                              <span
                                key={`${m.rolle.id}-${m.gewerk ?? 'alle'}`}
                                className="role-chip"
                                style={{ color: m.rolle.farbe }}
                              >
                                {m.rolle.kuerzel || m.rolle.name}
                                {m.gewerk ? ` · ${m.gewerk}` : ''}
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

      {rolleErgaenzen ? (
        <RolleErgaenzenDialog project={project} vorhanden={rollen} onClose={() => setRolleErgaenzen(false)} />
      ) : null}

      {rolleLoeschen ? (
        <ConfirmDialog
          titel="Rolle aus dem Projekt entfernen?"
          text={`„${rolleLoeschen.name}“ wird aus dem Projekt und aus allen Zuweisungen entfernt. Die Standardrolle bleibt erhalten.`}
          onConfirm={() => {
            deleteRole(rolleLoeschen.id);
            toast('Rolle entfernt.');
          }}
          onClose={() => setRolleLoeschen(null)}
        />
      ) : null}
    </div>
  );
}

/** Ergänzt das Projekt um eine Standardrolle oder eine eigene Rolle. */
function RolleErgaenzenDialog({
  project,
  vorhanden,
  onClose,
}: {
  project: Project;
  vorhanden: Role[];
  onClose: () => void;
}) {
  const { data, addRole } = useStore();
  const toast = useToast();
  const [eigene, setEigene] = useState('');

  const offeneStandards = data.standardRollen.filter(
    (s) => !vorhanden.some((r) => r.name.toLowerCase() === s.name.toLowerCase()),
  );

  const uebernehmen = (
    name: string,
    kuerzel: string,
    farbe: string,
    beschreibung: string,
    gewerkBezug: Role['gewerkBezug'] = 'individuell',
  ) => {
    addRole({ projectId: project.id, name, kuerzel, farbe, beschreibung, gewerkBezug });
    toast(`Rolle „${name}“ ergänzt.`);
  };

  return (
    <Modal
      titel="Rolle ergänzen"
      sub="Standardrolle übernehmen oder eigene Rolle anlegen"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Fertig
        </button>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <h3 style={{ marginBottom: 8 }}>Standardrollen</h3>
          {offeneStandards.length === 0 ? (
            <p className="small tertiary">Alle Standardrollen sind im Projekt vorhanden.</p>
          ) : (
            <div className="row wrap" style={{ gap: 6 }}>
              {offeneStandards.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="role-chip"
                  style={{ color: s.farbe, cursor: 'pointer', padding: '4px 11px' }}
                  onClick={() => uebernehmen(s.name, s.kuerzel, s.farbe, s.beschreibung, s.gewerkBezug)}
                >
                  <Icon name="plus" size={12} /> {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 8 }}>Eigene Rolle</h3>
          <div className="row">
            <TextInput
              value={eigene}
              onChange={setEigene}
              placeholder="Bezeichnung, z.B. Prüfstatiker"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && eigene.trim()) {
                  uebernehmen(
                    eigene.trim(),
                    eigene.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
                    FARBEN[vorhanden.length % FARBEN.length],
                    '',
                  );
                  setEigene('');
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!eigene.trim()) return;
                uebernehmen(
                  eigene.trim(),
                  eigene.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
                  FARBEN[vorhanden.length % FARBEN.length],
                  '',
                );
                setEigene('');
              }}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
          <p className="small tertiary" style={{ marginTop: 8 }}>
            Eigene Rollen gelten nur in diesem Projekt. Projektübergreifend gültige Rollen werden im Reiter
            <strong> Rollen</strong> gepflegt.
          </p>
        </div>
      </div>
    </Modal>
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
    anschrift: contact?.anschrift ?? '',
    notiz: contact?.notiz ?? '',
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const speichern = () => {
    if (!form.nachname.trim()) {
      toast('Bitte einen Nachnamen angeben.');
      return;
    }
    if (contact) updateContact(contact.id, form);
    else addContact({ ...form, projectId: project.id, zuordnungen: [] });
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
          <Field label="Rollen im Projekt" full hint="Zugewiesen wird oben in der Liste „Rollen im Projekt“.">
            <div className="row wrap" style={{ gap: 6 }}>
              {(contact?.zuordnungen ?? []).length === 0 ? (
                <span className="tertiary small">noch keine Rolle zugewiesen</span>
              ) : (
                (contact?.zuordnungen ?? []).map((z) => {
                  const r = rollen.find((x) => x.id === z.roleId);
                  if (!r) return null;
                  return (
                    <span key={`${z.roleId}-${z.gewerk ?? 'alle'}`} className="role-chip" style={{ color: r.farbe }}>
                      {r.name}
                      {z.gewerk ? ` · ${z.gewerk}` : ''}
                    </span>
                  );
                })
              )}
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
