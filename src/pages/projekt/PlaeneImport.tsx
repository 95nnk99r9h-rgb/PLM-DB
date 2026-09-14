/**
 * Einlesen von Plänen, Planpaketen und Planverzeichnissen aus einer Excel-Datei
 * (.xlsx) oder Textliste (.csv).
 *
 * Übergeordnete Einträge werden über die Spalte „Übergeordnet“ zugeordnet
 * (Plancodierung bzw. Name des Pakets oder Verzeichnisses). Für jeden
 * übergeordneten Eintrag kann anschließend ein Planlauf gestartet werden.
 */
import { useRef, useState } from 'react';
import {
  DOCUMENT_KIND_LABEL,
  type DocumentKind,
  type PlanDocument,
  type Project,
} from '../../domain/types';
import { datumLesen, spaltenZuordnen, tabelleLesen } from '../../lib/xlsxLesen';
import { kontaktFuerRolleUndGewerk, stepsAusTemplate } from '../../domain/engine';
import { formatDate, today } from '../../lib/dates';
import { dateiLaden, xlsxErzeugen } from '../../lib/xlsx';
import { newId, useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { Callout, Modal } from '../../components/ui';
import { Icon } from '../../components/icons';

/**
 * Erwartete Spalten laut Vorgabe. Zusätzliche Überschriften werden erkannt,
 * damit auch abweichend benannte Listen eingelesen werden können.
 */
const SPALTEN: Record<string, string[]> = {
  art: ['Art', 'Typ'],
  nummer: [
    'Plancodierung/Name Planpaket / Name Plan VZ',
    'Plancodierung',
    'Name Planpaket',
    'Name PlanVZ',
    'Name Plan VZ',
    'Nummer',
    'Name',
  ],
  index: ['Index/Ausgabe', 'Index', 'Ausgabe', 'Revision'],
  titel: ['Titel', 'Bezeichnung'],
  gewerk: ['Gewerk'],
  planungsphase: ['Planungsphase', 'Phase'],
  eingangSoll: ['Eingang Soll', 'Eingang', 'Soll'],
  bemerkung: ['Bemerkung', 'Notiz'],
  workflow: ['Workflow', 'Prozesskette', 'Kette'],
  // Nicht Teil der Vorgabe, wird aber ausgewertet, falls vorhanden
  parent: ['Übergeordnet', 'Gehört zu'],
};

const KOPFZEILE = [
  'Art',
  'Plancodierung/Name Planpaket / Name Plan VZ',
  'Index/Ausgabe',
  'Titel',
  'Gewerk',
  'Planungsphase',
  'Eingang Soll',
  'Bemerkung',
  'Workflow',
];

/** Erkennt die Art aus der Spaltenangabe. */
function artLesen(wert: string): DocumentKind {
  const t = wert.trim().toLowerCase();
  if (t.startsWith('planpaket') || t === 'paket' || t === 'pp') return 'paket';
  if (t.startsWith('planverzeichnis') || t === 'verzeichnis' || t === 'pv') return 'verzeichnis';
  return 'plan';
}

interface Zeile {
  doc: Omit<PlanDocument, 'id' | 'parentId'>;
  parentNummer: string;
  /** Name des Workflows aus der Liste; leer = kein Planlauf starten. */
  workflow: string;
  workflowId: string | null;
  hinweis: string;
}

export function PlaeneImport({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data, addDocument, updateDocument, addRun } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fehler, setFehler] = useState('');
  const [datei, setDatei] = useState('');
  const [vorschau, setVorschau] = useState<Zeile[]>([]);

  const vorhandene = data.documents.filter((d) => d.projectId === project.id);
  const vorlagen = data.templates.filter((t) => t.projectId === null || t.projectId === project.id);
  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const kontakte = data.contacts.filter((c) => c.projectId === project.id);

  const vorlage = () => {
    const beispiele = [
      ['Planpaket', 'NK-KIB-EÜ-001', 'C', 'Eisenbahnüberführung Nordkanal', 'KIB', 'Ausführungsplanung', '14.10.2026', '', 'VVBau mit Prüfstatik'],
      ['Plan', 'NK-LST-SP-102', 'B', 'Signallageplan Bereich Nord', 'LST', 'Ausführungsplanung', '30.10.2026', '', 'VVBau STE'],
      ['Planverzeichnis', 'NK-VA-PV-001', '02', 'Planverzeichnis Verkehrsanlagen', 'VA', 'Entwurfsplanung', '30.11.2026', '', ''],
    ];
    dateiLaden(
      xlsxErzeugen([{ name: 'Pläne', zeilen: [KOPFZEILE, ...beispiele] }]),
      'Vorlage-Plaene.xlsx',
    );
  };

  const lies = async (f: File) => {
    setFehler('');
    setVorschau([]);
    setDatei(f.name);
    try {
      const tabellen = await tabelleLesen(f);
      const tabelle = tabellen.find((t) => t.zeilen.length > 1) ?? tabellen[0];
      if (!tabelle || tabelle.zeilen.length < 2) {
        setFehler('Die Datei enthält keine Datenzeilen.');
        return;
      }
      const [kopf, ...zeilen] = tabelle.zeilen;
      const spalten = spaltenZuordnen(kopf, SPALTEN);
      if (spalten.nummer === undefined && spalten.titel === undefined) {
        setFehler(
          `Weder „Plancodierung“ noch „Titel“ gefunden. Gelesene Überschriften: ${kopf.join(', ') || '(keine)'}`,
        );
        return;
      }

      const wert = (zeile: string[], feld: string) =>
        spalten[feld] !== undefined ? (zeile[spalten[feld]] ?? '').trim() : '';

      const ergebnis: Zeile[] = zeilen.map((zeile) => {
        const art = artLesen(wert(zeile, 'art'));
        const nummer = wert(zeile, 'nummer');
        const parentNummer = wert(zeile, 'parent');
        const workflow = wert(zeile, 'workflow');
        const hinweise: string[] = [];

        if (vorhandene.some((d) => d.nummer && d.nummer === nummer)) {
          hinweise.push('Eintrag mit dieser Bezeichnung ist bereits vorhanden');
        }
        if (parentNummer && art !== 'plan') hinweise.push('nur Pläne können untergeordnet werden');

        const vorlage = workflow
          ? vorlagen.find((t) => t.name.trim().toLowerCase() === workflow.toLowerCase())
          : undefined;
        if (workflow && !vorlage) hinweise.push(`Workflow „${workflow}“ ist nicht hinterlegt`);

        return {
          doc: {
            projectId: project.id,
            kind: art,
            nummer,
            titel: wert(zeile, 'titel') || nummer,
            index: wert(zeile, 'index'),
            gewerk: wert(zeile, 'gewerk'),
            planungsphase: wert(zeile, 'planungsphase'),
            eingangSoll: datumLesen(wert(zeile, 'eingangSoll')),
            bemerkung: wert(zeile, 'bemerkung'),
          },
          parentNummer: art === 'plan' ? parentNummer : '',
          workflow,
          workflowId: vorlage?.id ?? null,
          hinweis: hinweise.join('; '),
        };
      });

      setVorschau(ergebnis.filter((e) => e.doc.nummer || e.doc.titel));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const uebernehmen = () => {
    // Erst die übergeordneten Einträge, damit die Zuordnung greifen kann
    const neueIds = new Map<string, string>();
    const reihenfolge = [...vorschau].sort((a, b) => (a.parentNummer ? 1 : 0) - (b.parentNummer ? 1 : 0));

    for (const z of reihenfolge) {
      const id = addDocument({ ...z.doc, parentId: null });
      if (z.doc.nummer) neueIds.set(z.doc.nummer, id);
    }

    let laeufe = 0;
    for (const z of reihenfolge) {
      const eigeneId = z.doc.nummer ? neueIds.get(z.doc.nummer) : undefined;
      if (!eigeneId) continue;

      // Zuordnung nachziehen (auch auf bereits vorhandene Pakete)
      const parentId = z.parentNummer
        ? (neueIds.get(z.parentNummer) ?? vorhandene.find((d) => d.nummer === z.parentNummer)?.id ?? null)
        : null;
      if (parentId) updateDocument(eigeneId, { parentId });

      // Planlauf starten, sofern ein Workflow benannt und der Eintrag eigenständig ist
      const vorlage = vorlagen.find((t) => t.id === z.workflowId);
      if (!vorlage || parentId) continue;

      const steps = stepsAusTemplate(
        vorlage,
        (roleName) => kontaktFuerRolleUndGewerk(kontakte, rollen, roleName, z.doc.gewerk),
        () => newId('rs'),
      );
      addRun({
        projectId: project.id,
        documentId: eigeneId,
        templateId: vorlage.id,
        templateName: vorlage.name,
        name: `Planlauf ${z.doc.nummer || z.doc.titel}${z.doc.index ? ` ${z.doc.index}` : ''}`,
        start: today(),
        status: 'laufend',
        abbruchGrund: null,
        abbruchDatum: null,
        abbruchArt: null,
        abbruchNeuerIndex: null,
        steps,
        bemerkung: '',
      });
      laeufe += 1;
    }

    toast(
      laeufe > 0
        ? `${vorschau.length} Einträge übernommen, ${laeufe} Planläufe gestartet.`
        : `${vorschau.length} Einträge übernommen.`,
    );
    onClose();
  };

  const mitHinweis = vorschau.filter((v) => v.hinweis).length;

  return (
    <Modal
      titel="Pläne aus Excel einlesen"
      sub="Erste Zeile als Spaltenüberschriften; .xlsx oder .csv"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={vorlage}>
            <Icon name="export" size={14} /> Vorlage
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={uebernehmen} disabled={vorschau.length === 0}>
            {vorschau.length > 0 ? `${vorschau.length} Einträge übernehmen` : 'Übernehmen'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div
          className={`drop-zone ${over ? 'over' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void lies(f);
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Icon name="importieren" size={26} strokeWidth={1.4} />
          </div>
          {datei ? (
            <>
              <strong>{datei}</strong>
              <div className="small">Andere Datei wählen</div>
            </>
          ) : (
            <>
              <strong>Excel- oder CSV-Datei hierher ziehen</strong>
              <div className="small">oder klicken, um eine Datei auszuwählen</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,.txt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void lies(f);
            }}
          />
        </div>

        {fehler ? (
          <Callout ton="error" icon="!">
            {fehler}
          </Callout>
        ) : null}

        {vorschau.length === 0 && !fehler ? (
          <Callout icon="i">
            Erwartete Spalten: <strong>{KOPFZEILE.join(' · ')}</strong>. In <em>Art</em> steht Plan, Planpaket
            oder Planverzeichnis. Ist in <em>Workflow</em> ein hinterlegter Workflow benannt, wird der Planlauf
            beim Import gleich gestartet. Eine zusätzliche Spalte <em>Übergeordnet</em> ordnet Pläne einem Paket
            oder Verzeichnis unter; solche Pläne erhalten keinen eigenen Planlauf. Über <em>Vorlage</em> erhalten
            Sie eine Datei mit genau diesen Spalten.
          </Callout>
        ) : null}

        {vorschau.length > 0 ? (
          <>
            {mitHinweis > 0 ? (
              <Callout ton="warn" icon="!">
                {mitHinweis} Zeile(n) mit Hinweisen – bitte vor dem Übernehmen prüfen.
              </Callout>
            ) : null}
            <div className="card" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Art</th>
                    <th>Bezeichnung / Titel</th>
                    <th>Gewerk</th>
                    <th>Eingang Soll</th>
                    <th>Workflow</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {vorschau.map((z, i) => (
                    <tr key={i}>
                      <td className="small muted">{DOCUMENT_KIND_LABEL[z.doc.kind]}</td>
                      <td>
                        <span className="num">{z.doc.nummer}</span>
                        <div>
                          <strong>{z.doc.titel}</strong>
                          {z.doc.index ? <span className="tertiary small"> · {z.doc.index}</span> : null}
                        </div>
                      </td>
                      <td className="small muted">{z.doc.gewerk || '–'}</td>
                      <td className="small">{z.doc.eingangSoll ? formatDate(z.doc.eingangSoll) : '–'}</td>
                      <td className="small muted">
                        {z.workflow || '–'}
                        {z.parentNummer ? (
                          <div className="tertiary small">untergeordnet: {z.parentNummer}</div>
                        ) : null}
                      </td>
                      <td className="small" style={{ color: z.hinweis ? 'var(--orange)' : undefined }}>
                        {z.hinweis || '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
