/** Projektübersicht: Kennzahlen, Fristenlage und letzte Aktivitäten. */
import { offeneFristen } from '../../domain/engine';
import { DOCUMENT_KIND_LABEL, type Project } from '../../domain/types';
import type { ProjektTab } from '../../lib/router';
import { useStore } from '../../store/store';
import { Card, CardHeader, EmptyState, Progress, Stat } from '../../components/ui';
import { Icon } from '../../components/icons';
import { PlanlaufListe } from '../../components/PlanlaufListe';

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
              <dt>Gewerke</dt>
              <dd>
                {[...new Set(dokumente.map((d) => d.gewerk).filter(Boolean))].join(', ') || '–'}
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
          <PlanlaufListe project={project} runs={aktiv} oeffneLauf={oeffneLauf} />
        )}
      </Card>
    </div>
  );
}
