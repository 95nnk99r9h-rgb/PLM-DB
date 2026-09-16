/** Projektübersicht: Kennzahlen, Fristenlage und letzte Aktivitäten. */
import { useState } from 'react';
import { eigenstaendigeLaeufe, fortschritt, offeneFristen } from '../../domain/engine';
import { type DocumentKind, type Project } from '../../domain/types';
import type { ProjektTab } from '../../lib/router';
import { useStore } from '../../store/store';
import { Card, CardHeader, EmptyState, Progress, Segmented, Stat } from '../../components/ui';
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
  // Gliederung der Planlaufliste: Pakete allein oder mit ihren Einträgen;
  // Pläne, die im Lauf ihres Verzeichnisses mitlaufen, sind zunächst aus.
  const [ebene, setEbene] = useState<'1' | '2'>('2');
  const [unterplaene, setUnterplaene] = useState(false);
  const dokumente = data.documents.filter((d) => d.projectId === project.id);
  // Ohne die Läufe von Plänen, die in einem Planverzeichnis mitlaufen
  const laeufe = eigenstaendigeLaeufe(data.documents, data.runs).filter(
    (r) => r.projectId === project.id,
  );
  const aktiv = laeufe.filter((r) => r.status === 'laufend');
  const abgeschlossen = laeufe.filter((r) => r.status === 'abgeschlossen');

  // Wie in der Planliste: je Eintrag der maßgebliche Lauf – der laufende,
  // sonst der abgeschlossene, sonst der abgebrochene.
  const rang = (r: (typeof laeufe)[number]) =>
    r.status === 'laufend' ? 0 : r.status === 'abgeschlossen' ? 1 : 2;
  const massgeblich = [...laeufe]
    .sort((a, b) => rang(a) - rang(b))
    .filter((r, i, alle) => alle.findIndex((x) => x.documentId === r.documentId) === i);
  const fristen = offeneFristen(data, [project.id]);
  const faellig = fristen.filter((f) => f.ampel === 'faellig').length;
  const ueberfaellig = fristen.filter((f) => f.ampel === 'ueberfaellig').length;
  const anzahl = (art: DocumentKind) => dokumente.filter((d) => d.kind === art).length;

  // Gesamtfortschritt: Mittel über alle eigenständigen Läufe ohne abgebrochene
  const gezaehlt = laeufe.filter((r) => r.status !== 'abgebrochen');
  const gesamt = gezaehlt.length
    ? Math.round(gezaehlt.reduce((summe, r) => summe + fortschritt(r), 0) / gezaehlt.length)
    : 0;

  return (
    <div className="stack">
      <Card>
        <div className="kennzahlen">
          <Stat wert={anzahl('paket')} label="Planpakete" onClick={() => gotoTab('pakete')} />
          <Stat wert={anzahl('verzeichnis')} label="Planverzeichnisse" onClick={() => gotoTab('plaene')} />
          <Stat wert={anzahl('plan')} label="Pläne" onClick={() => gotoTab('plaene')} />
          <Stat wert={faellig} label="Fällige Schritte" ton={faellig ? 'orange' : ''} />
          <Stat wert={ueberfaellig} label="Überfällige Schritte" ton={ueberfaellig ? 'red' : 'green'} />
        </div>
        <div className="card-pad row" style={{ gap: 14 }}>
          <span className="small muted" style={{ flex: 'none' }}>
            Gesamtfortschritt der Planläufe
          </span>
          <span style={{ flex: 1 }}>
            <Progress wert={gesamt} ton={gesamt === 100 ? 'green' : ''} />
          </span>
          <b className="small" style={{ flex: 'none', minWidth: 38, textAlign: 'right' }}>{gesamt}%</b>
        </div>
      </Card>

      <Card>
        <CardHeader
          titel="Planläufe"
          sub={`${aktiv.length} laufend · ${abgeschlossen.length} abgeschlossen`}
          actions={
            <span className="row wrap" style={{ gap: 10 }}>
              <Segmented<'1' | '2'>
                value={ebene}
                onChange={setEbene}
                options={[
                  { value: '1', label: 'Planpakete' },
                  { value: '2', label: '+ Pläne & Verzeichnisse' },
                ]}
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={unterplaene}
                  onChange={(e) => setUnterplaene(e.target.checked)}
                />
                Untergeordnete Pläne anzeigen
              </label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => gotoTab('plaene')}>
                Alle <Icon name="chevron" size={13} />
              </button>
            </span>
          }
        />
        {massgeblich.length === 0 ? (
          <EmptyState
            icon="kette"
            titel="Noch kein Planlauf"
            text="Starten Sie einen Lauf für einen Plan oder ein Planverzeichnis."
          />
        ) : (
          <PlanlaufListe
            project={project}
            runs={massgeblich}
            alleRuns={laeufe}
            ebene={Number(ebene) as 1 | 2}
            unterplaene={unterplaene}
            oeffneLauf={oeffneLauf}
          />
        )}
      </Card>
    </div>
  );
}
