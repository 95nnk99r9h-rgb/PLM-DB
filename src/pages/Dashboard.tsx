/**
 * Startseite: Kennzahlen, eigene To-Dos und die laufenden Planläufe,
 * nach Projekten gegliedert. Angezeigt werden die markierten Projekte.
 */
import {
  aktuellerSchritt,
  ampelFuerSchritt,
  eigeneTodos,
  fortschritt,
  istAktiv,
  offeneFristen,
} from '../domain/engine';
import { formatDate, relativeLabel } from '../lib/dates';
import type { Project } from '../domain/types';
import type { Route } from '../lib/router';
import { useStore } from '../store/store';
import { AmpelBadge, AmpelPunkt, RunStatusBadge } from '../components/common';
import { Card, CardHeader, EmptyState, Progress, Stat } from '../components/ui';
import { Icon } from '../components/icons';

/** Markierte Projekte; ohne Markierung werden alle angezeigt. */
export function sichtbareProjekte(projects: Project[]): Project[] {
  const markiert = projects.filter((p) => p.markiert);
  return markiert.length > 0 ? markiert : projects;
}

export function Dashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { data } = useStore();
  const projekte = sichtbareProjekte(data.projects);
  const ids = projekte.map((p) => p.id);

  const fristen = offeneFristen(data, ids);
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig');
  const faellig = fristen.filter((f) => f.ampel === 'faellig');
  const todos = eigeneTodos(data, ids);
  const laufend = data.runs.filter((r) => ids.includes(r.projectId) && istAktiv(r));

  const alleMarkiert = data.projects.filter((p) => p.markiert).length;

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat wert={laufend.length} label="Laufende Planläufe" />
        <Stat
          wert={ueberfaellig.length}
          label="Überfällige Schritte"
          ton={ueberfaellig.length ? 'red' : 'green'}
          onClick={() => navigate({ view: 'fristen' })}
        />
        <Stat wert={todos.length} label={`To-Dos (${data.bearbeiter.rolle})`} ton="blue" />
        <Stat
          wert={faellig.length}
          label="Demnächst fällig"
          ton={faellig.length ? 'orange' : ''}
          onClick={() => navigate({ view: 'fristen' })}
        />
      </div>

      {alleMarkiert === 0 ? (
        <p className="small tertiary">
          Kein Projekt markiert – es werden alle Projekte angezeigt. Unter <strong>Projekte</strong> lassen sich
          einzelne Projekte markieren; dann erscheinen nur diese hier und in der Seitenleiste.
        </p>
      ) : null}

      <Card>
        <CardHeader
          titel={`Meine To-Dos als ${data.bearbeiter.rolle}`}
          sub="Laufende Schritte im eigenen Verantwortungsbereich"
        />
        {todos.length === 0 ? (
          <EmptyState icon="check" titel="Nichts offen" text="Derzeit liegt kein Schritt bei Ihnen." />
        ) : (
          <div className="table-scroll">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th className="col-optional" style={{ width: 22 }} />
                  <th>Schritt / Planlauf</th>
                  <th className="col-optional">Projekt</th>
                  <th>Soll-Termin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todos.map((f) => (
                  <tr
                    key={`${f.run.id}-${f.step.id}`}
                    className="clickable"
                    onClick={() => navigate({ view: 'planlauf', projectId: f.project.id, runId: f.run.id })}
                  >
                    <td className="col-optional">
                      <AmpelPunkt ampel={f.ampel} />
                    </td>
                    <td>
                      <strong>{f.step.name}</strong>
                      <div className="small tertiary">{f.run.name}</div>
                    </td>
                    <td className="small muted col-optional">
                      {f.project.nummer} {f.project.name}
                    </td>
                    <td className="small">
                      {formatDate(f.step.sollDatum)}
                      <div className="tertiary small">{relativeLabel(f.step.sollDatum)}</div>
                    </td>
                    <td>
                      <AmpelBadge ampel={f.ampel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2>Laufende Planläufe</h2>
      {laufend.length === 0 ? (
        <Card>
          <EmptyState icon="kette" titel="Kein Planlauf aktiv" text="Starten Sie einen Planlauf in einem Projekt." />
        </Card>
      ) : (
        projekte
          .filter((p) => laufend.some((r) => r.projectId === p.id))
          .map((project) => {
            const laeufe = laufend.filter((r) => r.projectId === project.id);
            return (
              <Card key={project.id}>
                <CardHeader
                  titel={
                    <span className="row" style={{ gap: 8 }}>
                      <span className="num tertiary">{project.nummer}</span>
                      {project.name}
                    </span>
                  }
                  sub={`${laeufe.length} laufende Planläufe`}
                  actions={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate({ view: 'projekt', projectId: project.id, tab: 'uebersicht' })}
                    >
                      Projekt öffnen <Icon name="chevron" size={13} />
                    </button>
                  }
                />
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Planlauf</th>
                        <th>Aktueller Schritt</th>
                        <th className="col-optional">Verantwortlich</th>
                        <th style={{ width: 150 }}>Fortschritt</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laeufe.map((run) => {
                        const step = aktuellerSchritt(run);
                        const ampel = step
                          ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage)
                          : 'erledigt';
                        const pct = fortschritt(run);
                        const kontakt = data.contacts.find((c) => c.id === step?.contactId);
                        return (
                          <tr
                            key={run.id}
                            className="clickable"
                            onClick={() => navigate({ view: 'planlauf', projectId: run.projectId, runId: run.id })}
                          >
                            <td>
                              <strong>{run.name}</strong>
                              <div className="small tertiary">{run.templateName}</div>
                            </td>
                            <td className="small">
                              <span className="row" style={{ gap: 7 }}>
                                <AmpelPunkt ampel={ampel} />
                                {step?.name ?? 'abgeschlossen'}
                              </span>
                              <span className="tertiary small">{relativeLabel(step?.sollDatum ?? null)}</span>
                            </td>
                            <td className="small col-optional">
                              {step?.roleName || '–'}
                              <div className="tertiary small">
                                {kontakt ? `${kontakt.vorname} ${kontakt.nachname}` : 'keine Person'}
                              </div>
                            </td>
                            <td>
                              <span className="row" style={{ gap: 8 }}>
                                <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : ''} />
                                <span className="small tertiary">{pct}%</span>
                              </span>
                            </td>
                            <td>
                              <RunStatusBadge status={run.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })
      )}
    </div>
  );
}
