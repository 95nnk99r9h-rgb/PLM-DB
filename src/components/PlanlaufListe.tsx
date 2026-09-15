/**
 * Übersicht der laufenden Planläufe eines Projekts.
 *
 * Dieselbe Darstellung wird auf der Startseite und im Projekt verwendet.
 * Einträge eines Planpakets stehen unter einer aufklappbaren Paketzeile; das
 * Paket selbst hat keinen Planlauf und darum auch keinen Erledigt-Haken.
 */
import { Fragment, useState } from 'react';
import { aktuellerSchritt, ampelFuerSchritt, fortschritt } from '../domain/engine';
import { relativeLabel } from '../lib/dates';
import { INDEX_LABEL, type PlanDocument, type PlanRun, type Project, type RunStep } from '../domain/types';
import { useStore } from '../store/store';
import { AmpelPunkt, DocKindIcon, RunStatusBadge } from './common';
import { EmailDialog } from './EmailDialog';
import { ErledigtButton, useSchrittStatus } from './SchrittStatus';
import { EmptyState, Progress } from './ui';
import { Icon } from './icons';

interface Eintrag {
  run: PlanRun;
  doc: PlanDocument | undefined;
  step: RunStep | undefined;
}

export function PlanlaufListe({
  project,
  runs,
  alleRuns,
  oeffneLauf,
}: {
  project: Project;
  /** Anzuzeigende Planläufe des Projekts. */
  runs: PlanRun[];
  /** Alle Läufe des Projekts – Grundlage für den Stand der Planpakete. */
  alleRuns?: PlanRun[];
  oeffneLauf: (runId: string) => void;
}) {
  const { data } = useStore();
  const { setzeStatus, nachweisDialog } = useSchrittStatus();
  const [mail, setMail] = useState<{ run: PlanRun; step: RunStep } | null>(null);
  const [offen, setOffen] = useState<string[]>([]);

  const eintraege: Eintrag[] = runs.map((run) => {
    const doc = data.documents.find((d) => d.id === run.documentId);
    return { run, doc, step: aktuellerSchritt(run) };
  });

  /** Maßgebliches Paket – bei Plänen eines Verzeichnisses dessen Paket. */
  const paketVon = (doc: PlanDocument | undefined): string | null => {
    if (!doc) return null;
    if (doc.kind === 'plan' && doc.parentId) {
      const eltern = data.documents.find((d) => d.id === doc.parentId);
      if (eltern) return eltern.paketId;
    }
    return doc.paketId;
  };

  // Einträge eines Planpakets stehen unter ihrer Paketzeile
  const pakete = data.documents.filter(
    (d) => d.kind === 'paket' && eintraege.some((e) => paketVon(e.doc) === d.id),
  );
  const ohnePaket = eintraege.filter((e) => !pakete.some((p) => p.id === paketVon(e.doc)));

  const klappen = (id: string) => setOffen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  /**
   * Stand eines Planpakets: Planpakete laufen selbst nicht, ihr Fortschritt
   * und Status ergeben sich aus den enthaltenen Plänen und Verzeichnissen.
   */
  const paketStand = (paketId: string) => {
    const zugehoerig = data.documents.filter((d) => d.kind !== 'paket' && paketVon(d) === paketId);
    const laeufe = (alleRuns ?? runs).filter((r) => zugehoerig.some((d) => d.id === r.documentId));
    if (laeufe.length === 0) return { pct: 0, status: null as PlanRun['status'] | null, anzahl: 0 };
    const pct = Math.round(laeufe.reduce((sum, r) => sum + fortschritt(r), 0) / laeufe.length);
    const status: PlanRun['status'] = laeufe.some((r) => r.status === 'laufend')
      ? 'laufend'
      : laeufe.every((r) => r.status === 'abgeschlossen')
        ? 'abgeschlossen'
        : 'abgebrochen';
    return { pct, status, anzahl: laeufe.filter((r) => r.status === 'laufend').length };
  };

  if (eintraege.length === 0) {
    return (
      <EmptyState icon="kette" titel="Kein Planlauf aktiv" text="Starten Sie einen Planlauf für einen Eintrag." />
    );
  }

  const zeile = ({ run, doc, step }: Eintrag, eingerueckt = false) => {
    const ampel = step ? ampelFuerSchritt(step, project.settings.erinnerungVorlaufTage) : 'erledigt';
    const pct = fortschritt(run);
    const kontakt = data.contacts.find((c) => c.id === step?.contactId);
    return (
      <tr key={run.id} className="clickable" onClick={() => oeffneLauf(run.id)}>
        <td style={eingerueckt ? { paddingLeft: 46 } : undefined}>
          <span className="row" style={{ gap: 9 }}>
            {doc ? <DocKindIcon kind={doc.kind} /> : null}
            <span style={{ minWidth: 0 }}>
              <span className="num">
                {doc?.nummer}
                {doc?.index ? ` · ${INDEX_LABEL[doc.kind]} ${doc.index}` : ''}
              </span>
              <div>
                <strong>{doc?.titel ?? run.name}</strong>
              </div>
            </span>
          </span>
        </td>
        <td className="small muted">{doc?.gewerk || '–'}</td>
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
        <td className="col-optional">
          <span className="row" style={{ gap: 8 }}>
            <Progress wert={pct} ton={ampel === 'ueberfaellig' ? 'red' : ''} />
            <span className="small tertiary">{pct}%</span>
          </span>
        </td>
        <td>
          <RunStatusBadge status={run.status} />
        </td>
        <td className="actions">
          {step ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                title="Vorbereitete E-Mail an die zuständige Person"
                aria-label="Erinnerung vorbereiten"
                onClick={(e) => {
                  e.stopPropagation();
                  setMail({ run, step });
                }}
              >
                <Icon name="mail" size={13} />
              </button>{' '}
              <ErledigtButton run={run} step={step} onErledigen={(r, sch) => setzeStatus(r, sch, 'erledigt')} />
            </>
          ) : null}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Plan / Planverzeichnis</th>
              <th>Gewerk</th>
              <th>Aktueller Schritt</th>
              <th className="col-optional">Zuständig</th>
              <th className="col-optional" style={{ width: 140 }}>
                Fortschritt
              </th>
              <th>Status</th>
              <th className="actions" />
            </tr>
          </thead>
          <tbody>
            {pakete.map((paket) => {
              const inhalt = eintraege.filter((e) => paketVon(e.doc) === paket.id);
              const aufgeklappt = offen.includes(paket.id);
              const stand = paketStand(paket.id);
              return (
                <Fragment key={paket.id}>
                  <tr className="paket-zeile">
                    <td>
                      <button
                        type="button"
                        className={`gruppe-btn ${aufgeklappt ? 'offen' : ''}`}
                        onClick={() => klappen(paket.id)}
                        title={aufgeklappt ? 'Einträge ausblenden' : 'Einträge anzeigen'}
                      >
                        <span className="chev">
                          <Icon name="chevron" size={13} />
                        </span>
                        <DocKindIcon kind="paket" />
                        <span style={{ minWidth: 0 }}>
                          {paket.nummer ? <span className="num">{paket.nummer}</span> : null}
                          <div>
                            <strong>{paket.titel}</strong>
                          </div>
                        </span>
                      </button>
                    </td>
                    <td className="small muted">{paket.gewerk || '–'}</td>
                    <td className="small tertiary" colSpan={2}>
                      Planpaket · {inhalt.length} laufende Einträge
                    </td>
                    <td className="col-optional">
                      <span className="row" style={{ gap: 8 }}>
                        <Progress wert={stand.pct} />
                        <span className="small tertiary">{stand.pct}%</span>
                      </span>
                    </td>
                    <td>{stand.status ? <RunStatusBadge status={stand.status} /> : null}</td>
                    <td className="actions" />
                  </tr>
                  {aufgeklappt ? inhalt.map((e) => zeile(e, true)) : null}
                </Fragment>
              );
            })}

            {ohnePaket.length > 0 && pakete.length > 0 ? (
              <tr className="paket-zeile ohne-paket">
                <td colSpan={7}>
                  <span className="small muted">Ohne Planpaket · {ohnePaket.length} Einträge</span>
                </td>
              </tr>
            ) : null}
            {ohnePaket.map((e) => zeile(e, pakete.length > 0))}
          </tbody>
        </table>
      </div>

      {mail ? (
        <EmailDialog project={project} run={mail.run} step={mail.step} onClose={() => setMail(null)} />
      ) : null}
      {nachweisDialog}
    </>
  );
}
