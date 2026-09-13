/** Startseite: Kennzahlen über alle Projekte und die dringendsten Fristen. */
import { fortschritt, offeneFristen, aktuellerSchritt, ampelFuerSchritt } from '../domain/engine';
import { formatDate, relativeLabel } from '../lib/dates';
import type { Route } from '../lib/router';
import { useStore } from '../store/store';
import { AmpelBadge, AmpelPunkt, RunStatusBadge } from '../components/common';
import { Card, CardHeader, EmptyState, Progress, Stat } from '../components/ui';
import { Icon } from '../components/icons';

export function Dashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { data } = useStore();
  const fristen = offeneFristen(data);
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig');
  const faellig = fristen.filter((f) => f.ampel === 'faellig');
  const laufend = data.runs.filter((r) => r.status === 'laufend');
  const aktiveProjekte = data.projects.filter((p) => p.status === 'aktiv');

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat wert={aktiveProjekte.length} label="Aktive Projekte" ton="blue" onClick={() => navigate({ view: 'projekte' })} />
        <Stat wert={laufend.length} label="Laufende Planläufe" />
        <Stat wert={ueberfaellig.length} label="Überfällige Schritte" ton="red" onClick={() => navigate({ view: 'fristen' })} />
        <Stat wert={faellig.length} label="Demnächst fällig" ton="orange" onClick={() => navigate({ view: 'fristen' })} />
      </div>

      <Card>
        <CardHeader
          titel="Dringendste Fristen"
          sub="Nach Soll-Termin sortiert – über alle Projekte"
          actions={
            <button type="button" className="btn btn-ghost" onClick={() => navigate({ view: 'fristen' })}>
              Alle anzeigen <Icon name="chevron" size={13} />
            </button>
          }
        />
        {fristen.length === 0 ? (
          <EmptyState icon="check" titel="Keine offenen Fristen" text="Alle Prozessschritte sind erledigt." />
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th style={{ width: 22 }} />
                <th>Schritt</th>
                <th className="col-optional">Planlauf</th>
                <th className="col-optional">Zuständig</th>
                <th>Soll</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {fristen.slice(0, 7).map((f) => {
                const kontakt = data.contacts.find((c) => c.id === f.step.contactId);
                return (
                  <tr
                    key={f.step.id}
                    className="clickable"
                    onClick={() => navigate({ view: 'planlauf', projectId: f.project.id, runId: f.run.id })}
                  >
                    <td><AmpelPunkt ampel={f.ampel} /></td>
                    <td>
                      <strong>{f.step.name}</strong>
                      <div className="small tertiary">{f.project.name}</div>
                    </td>
                    <td className="small muted col-optional">{f.run.name}</td>
                    <td className="small col-optional">
                      {kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : <span className="tertiary">offen</span>}
                    </td>
                    <td className="small">
                      {formatDate(f.step.sollDatum)}
                      <div className="tertiary small">{relativeLabel(f.step.sollDatum)}</div>
                    </td>
                    <td><AmpelBadge ampel={f.ampel} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <CardHeader titel="Laufende Planläufe" sub={`${laufend.length} aktiv`} />
        {laufend.length === 0 ? (
          <EmptyState icon="kette" titel="Kein Planlauf aktiv" text="Starten Sie einen Planlauf in einem Projekt." />
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Planlauf</th>
                <th className="col-optional">Projekt</th>
                <th>Aktueller Schritt</th>
                <th style={{ width: 150 }}>Fortschritt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {laufend.map((run) => {
                const project = data.projects.find((p) => p.id === run.projectId);
                const step = aktuellerSchritt(run);
                const ampel = step ? ampelFuerSchritt(step, project?.settings.erinnerungVorlaufTage ?? 5) : 'erledigt';
                const pct = fortschritt(run);
                return (
                  <tr
                    key={run.id}
                    className="clickable"
                    onClick={() => navigate({ view: 'planlauf', projectId: run.projectId, runId: run.id })}
                  >
                    <td><strong>{run.name}</strong></td>
                    <td className="small muted col-optional">{project?.name ?? '–'}</td>
                    <td className="small">
                      <span className="row" style={{ gap: 7 }}>
                        <AmpelPunkt ampel={ampel} />
                        {step?.name ?? 'abgeschlossen'}
                      </span>
                      <span className="tertiary small">{relativeLabel(step?.sollDatum ?? null)}</span>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : ''} />
                        <span className="small tertiary">{pct}%</span>
                      </span>
                    </td>
                    <td><RunStatusBadge status={run.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
