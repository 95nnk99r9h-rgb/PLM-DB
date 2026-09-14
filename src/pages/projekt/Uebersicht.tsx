/** Projektübersicht: Kennzahlen, Fristenlage und letzte Aktivitäten. */
import { aktuellerSchritt, ampelFuerSchritt, fortschritt, offeneFristen } from '../../domain/engine';
import { formatDate, relativeLabel } from '../../lib/dates';
import { DOCUMENT_KIND_LABEL, type Project } from '../../domain/types';
import type { ProjektTab } from '../../lib/router';
import { useStore } from '../../store/store';
import { AmpelPunkt, RunStatusBadge } from '../../components/common';
import { Card, CardHeader, EmptyState, Progress, Stat } from '../../components/ui';
import { Icon } from '../../components/icons';

export function Uebersicht({
  project,
  gotoTab,
  oeffneLauf,
}: {
  project: Project;
  gotoTab: (t: ProjektTab) => void;
  oeffneLauf: (runId: string) => void;
}) {
  const { data } = useStore();
  const dokumente = data.documents.filter((d) => d.projectId === project.id);
  const laeufe = data.runs.filter((r) => r.projectId === project.id);
  const aktiv = laeufe.filter((r) => r.status === 'laufend');
  const fristen = offeneFristen(data, [project.id]);
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig');
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);

  const proArt = (['paket', 'plan', 'verzeichnis'] as const).map((k) => ({
    art: DOCUMENT_KIND_LABEL[k],
    anzahl: dokumente.filter((d) => d.kind === k).length,
  }));

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat wert={dokumente.length} label="Pläne, Pakete & Verzeichnisse" onClick={() => gotoTab('plaene')} />
        <Stat wert={aktiv.length} label="Laufende Planläufe" ton="blue" onClick={() => gotoTab('plaene')} />
        <Stat wert={ueberfaellig.length} label="Überfällige Schritte" ton={ueberfaellig.length ? 'red' : 'green'} />
        <Stat wert={kontakte.length} label="Kontakte im Adressbuch" onClick={() => gotoTab('adressbuch')} />
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader titel="Projekt" sub={project.beschreibung || 'Keine Beschreibung hinterlegt'} />
          <div className="card-pad">
            <dl className="kv">
              <dt>Nummer</dt>
              <dd className="mono">{project.nummer || '–'}</dd>
              <dt>Bauherr</dt>
              <dd>{project.bauherr || '–'}</dd>
              <dt>Ort</dt>
              <dd>{project.ort || '–'}</dd>
              <dt>Laufzeit</dt>
              <dd>
                {formatDate(project.start)} – {project.ende ? formatDate(project.ende) : 'offen'}
              </dd>
              <dt>Fristen</dt>
              <dd>
                {project.settings.fristenInArbeitstagen ? 'in Arbeitstagen' : 'in Kalendertagen'} · Erinnerung{' '}
                {project.settings.erinnerungVorlaufTage} Tage vorher
              </dd>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader titel="Planbestand" sub="Verteilung nach Art" />
          <div className="card-pad stack" style={{ gap: 12 }}>
            {proArt.map((a) => (
              <div key={a.art} className="row-between">
                <span className="small">{a.art}</span>
                <span className="row" style={{ gap: 10 }}>
                  <Progress wert={dokumente.length ? (a.anzahl / dokumente.length) * 100 : 0} />
                  <b style={{ minWidth: 22, textAlign: 'right' }}>{a.anzahl}</b>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          titel="Laufende Planläufe"
          sub={`${aktiv.length} von ${laeufe.length}`}
          actions={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => gotoTab('plaene')}>
              Alle <Icon name="chevron" size={13} />
            </button>
          }
        />
        {aktiv.length === 0 ? (
          <EmptyState icon="kette" titel="Kein aktiver Planlauf" text="Starten Sie einen Lauf für einen Plan oder ein Paket." />
        ) : (
          <div className="table-scroll"><table className="table">
            <thead>
              <tr>
                <th>Planlauf</th>
                <th>Aktueller Schritt</th>
                <th>Soll</th>
                <th style={{ width: 140 }}>Fortschritt</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {aktiv.map((run) => {
                const step = aktuellerSchritt(run);
                const ampel = step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'erledigt';
                const pct = fortschritt(run);
                return (
                  <tr key={run.id} className="clickable" onClick={() => oeffneLauf(run.id)}>
                    <td>
                      <strong>{run.name}</strong>
                      <div className="small tertiary">{run.templateName}</div>
                    </td>
                    <td className="small">
                      <span className="row" style={{ gap: 7 }}>
                        <AmpelPunkt ampel={ampel} />
                        {step?.name ?? '–'}
                      </span>
                    </td>
                    <td className="small">
                      {formatDate(step?.sollDatum ?? null)}
                      <div className="tertiary small">{relativeLabel(step?.sollDatum ?? null)}</div>
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
