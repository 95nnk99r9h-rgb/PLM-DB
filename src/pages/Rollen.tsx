/**
 * Projektübergreifende Standardrollen. Neue Projekte übernehmen diese Rollen;
 * innerhalb eines Projekts lassen sie sich im Adressbuch mit Personen belegen
 * und um projekteigene Rollen ergänzen.
 */
import { useState } from 'react';
import { GEWERKBEZUG_LABEL, type GewerkBezug, type StandardRolle } from '../domain/types';
import { useStore } from '../store/store';
import { useToast } from '../components/toast';
import { Badge, Card, CardHeader, ConfirmDialog, EmptyState, Field, Modal, Select, TextArea, TextInput } from '../components/ui';
import { Icon } from '../components/icons';

const FARBEN = ['#0071e3', '#5856d6', '#ff9500', '#34c759', '#ff3b30', '#af52de', '#00a0a0', '#c77700'];

export function Rollen() {
  const { data, addStandardRolle, deleteStandardRolle } = useStore();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ rolle?: StandardRolle } | null>(null);
  const [loeschen, setLoeschen] = useState<StandardRolle | null>(null);

  const rollen = data.standardRollen;

  /** In wie vielen Projekten die Rolle (namensgleich) verwendet wird. */
  const verwendung = (name: string) =>
    new Set(
      data.roles.filter((r) => r.name.toLowerCase() === name.toLowerCase()).map((r) => r.projectId),
    ).size;

  return (
    <div className="stack">
      <div className="row-between wrap">
        <p className="muted small" style={{ maxWidth: 640 }}>
          Standardrollen gelten projektübergreifend und werden beim Anlegen eines Projekts übernommen. Rollen mit
          Besetzung „je Gewerk“ werden im Adressbuch für jedes Gewerk einzeln mit Personen belegt.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
          <Icon name="plus" size={14} /> Neue Rolle
        </button>
      </div>

      <Card>
        <CardHeader titel="Standardrollen" sub={`${rollen.length} Rollen`} />
        {rollen.length === 0 ? (
          <EmptyState
            icon="person"
            titel="Keine Standardrollen"
            text="Legen Sie die Rollen an, die in Ihren Projekten regelmäßig vorkommen."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
                <Icon name="plus" size={14} /> Neue Rolle
              </button>
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Rolle</th>
                  <th>Kürzel</th>
                  <th>Besetzung</th>
                  <th className="col-optional">Beschreibung</th>
                  <th>Verwendung</th>
                  <th className="actions" />
                </tr>
              </thead>
              <tbody>
                {rollen.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setDialog({ rolle: r })}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="dot" style={{ background: r.farbe }} />
                        <strong>{r.name}</strong>
                      </span>
                    </td>
                    <td className="num">{r.kuerzel || '–'}</td>
                    <td>
                      <Badge ton={r.gewerkBezug === 'individuell' ? 'orange' : 'blue'}>
                        {GEWERKBEZUG_LABEL[r.gewerkBezug]}
                      </Badge>
                    </td>
                    <td className="small muted col-optional">{r.beschreibung || '–'}</td>
                    <td className="small muted">
                      {verwendung(r.name) > 0 ? `${verwendung(r.name)} Projekt(e)` : 'noch nicht verwendet'}
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label="Löschen"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoeschen(r);
                        }}
                      >
                        <Icon name="loeschen" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog ? (
        <RollenDialog
          rolle={dialog.rolle}
          anzahl={rollen.length}
          onClose={() => setDialog(null)}
          onAnlegen={(werte) => {
            addStandardRolle(werte);
            toast('Standardrolle angelegt.');
          }}
        />
      ) : null}

      {loeschen ? (
        <ConfirmDialog
          titel="Standardrolle löschen?"
          text={`„${loeschen.name}“ steht neuen Projekten nicht mehr zur Verfügung. Bereits angelegte Projektrollen bleiben erhalten.`}
          onConfirm={() => {
            deleteStandardRolle(loeschen.id);
            toast('Standardrolle gelöscht.');
          }}
          onClose={() => setLoeschen(null)}
        />
      ) : null}
    </div>
  );
}

function RollenDialog({
  rolle,
  anzahl,
  onClose,
  onAnlegen,
}: {
  rolle?: StandardRolle;
  anzahl: number;
  onClose: () => void;
  onAnlegen: (werte: Omit<StandardRolle, 'id'>) => void;
}) {
  const { updateStandardRolle } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({
    name: rolle?.name ?? '',
    kuerzel: rolle?.kuerzel ?? '',
    farbe: rolle?.farbe ?? FARBEN[anzahl % FARBEN.length],
    beschreibung: rolle?.beschreibung ?? '',
    gewerkBezug: rolle?.gewerkBezug ?? ('individuell' as GewerkBezug),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const speichern = () => {
    if (!form.name.trim()) {
      toast('Bitte einen Namen angeben.');
      return;
    }
    const werte = {
      ...form,
      kuerzel: form.kuerzel.trim() || form.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
    };
    if (rolle) {
      updateStandardRolle(rolle.id, werte);
      toast('Standardrolle gespeichert.');
    } else {
      onAnlegen(werte);
    }
    onClose();
  };

  return (
    <Modal
      titel={rolle ? 'Standardrolle bearbeiten' : 'Neue Standardrolle'}
      sub="Gilt projektübergreifend"
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
          <TextInput value={form.name} onChange={(v) => set('name', v)} placeholder="z.B. Prüfstatiker" />
        </Field>
        <Field label="Kürzel" hint="leer = aus dem Namen gebildet">
          <TextInput value={form.kuerzel} onChange={(v) => set('kuerzel', v)} />
        </Field>
        <Field label="Besetzung" hint="„je Gewerk“: eigene Person je Gewerk, z.B. ein Fachplaner je Gewerk">
          <Select
            value={form.gewerkBezug}
            onChange={(v) => set('gewerkBezug', v as GewerkBezug)}
            options={Object.entries(GEWERKBEZUG_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Farbe">
          <input
            type="color"
            value={form.farbe}
            onChange={(e) => set('farbe', e.target.value)}
            style={{ width: 52, height: 32, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          />
        </Field>
        <Field label="Beschreibung" full>
          <TextArea value={form.beschreibung} onChange={(v) => set('beschreibung', v)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
