/**
 * Einlesen von Kontakten aus einer Excel-Datei (.xlsx) oder Textliste (.csv).
 *
 * Erwartet werden Spaltenüberschriften in der ersten Zeile; Schreibweise und
 * Reihenfolge sind frei. Eine Vorlage mit den erwarteten Spalten lässt sich
 * herunterladen.
 */
import { useRef, useState } from 'react';
import { UEBERGREIFEND, type Contact, type Project, type Zuordnung } from '../../domain/types';
import { spaltenZuordnen, tabelleLesen } from '../../lib/xlsxLesen';
import { dateiLaden, xlsxErzeugen } from '../../lib/xlsx';
import { useStore } from '../../store/store';
import { useToast } from '../../components/toast';
import { Callout, Modal } from '../../components/ui';
import { Icon } from '../../components/icons';

/**
 * Erwartete Spalten laut Vorgabe. Zusätzliche Überschriften werden erkannt,
 * damit auch abweichend benannte Listen eingelesen werden können.
 */
const SPALTEN: Record<string, string[]> = {
  vorname: ['Vorname'],
  nachname: ['Name', 'Nachname'],
  firma: ['Firma', 'Büro', 'Unternehmen'],
  telefon: ['Telefon', 'Tel', 'Telefonnummer'],
  email: ['Email', 'E-Mail', 'Mail'],
  strasse: ['Straße', 'Strasse'],
  hausnummer: ['Nr.', 'Nr', 'Hausnummer'],
  plz: ['PLZ', 'Postleitzahl'],
  ort: ['Ort'],
  // Nicht Teil der Vorgabe, wird aber übernommen, falls vorhanden
  anrede: ['Anrede'],
  gewerk: ['Gewerk'],
  funktion: ['Funktion', 'Rolle'],
  notiz: ['Notiz', 'Bemerkung'],
};

const KOPFZEILE = ['Vorname', 'Name', 'Firma', 'Telefon', 'Email', 'Straße', 'Nr.', 'PLZ', 'Ort'];

/** Setzt die Anschrift aus Straße, Hausnummer, PLZ und Ort zusammen. */
function anschriftBauen(strasse: string, nr: string, plz: string, ort: string): string {
  const zeile1 = [strasse, nr].filter(Boolean).join(' ');
  const zeile2 = [plz, ort].filter(Boolean).join(' ');
  return [zeile1, zeile2].filter(Boolean).join('\n');
}

interface Vorschau {
  kontakt: Omit<Contact, 'id'>;
  hinweis: string;
}

export function KontakteImport({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data, addContact } = useStore();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [fehler, setFehler] = useState('');
  const [datei, setDatei] = useState('');
  const [vorschau, setVorschau] = useState<Vorschau[]>([]);

  const rollen = data.roles.filter((r) => r.projectId === project.id);
  const vorhandene = data.contacts.filter((c) => c.projectId === project.id);

  const vorlage = () => {
    const beispiel = [
      'Katrin',
      'Berger',
      'Ingenieurbüro Berger',
      '+49 40 998877-12',
      'k.berger@example.de',
      'Billstraße',
      '88',
      '20539',
      'Hamburg',
    ];
    dateiLaden(xlsxErzeugen([{ name: 'Kontakte', zeilen: [KOPFZEILE, beispiel] }]), 'Vorlage-Kontakte.xlsx');
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
      if (spalten.nachname === undefined) {
        setFehler(
          `Die Spalte „Nachname“ wurde nicht gefunden. Gelesene Überschriften: ${kopf.join(', ') || '(keine)'}`,
        );
        return;
      }

      const wert = (zeile: string[], feld: string) =>
        spalten[feld] !== undefined ? (zeile[spalten[feld]] ?? '').trim() : '';

      const ergebnis: Vorschau[] = zeilen.map((zeile) => {
        const gewerk = wert(zeile, 'gewerk');
        const funktion = wert(zeile, 'funktion');
        const hinweise: string[] = [];

        const nachname = wert(zeile, 'nachname');
        const email = wert(zeile, 'email');
        const doppelt = vorhandene.some(
          (c) =>
            (email && c.email.toLowerCase() === email.toLowerCase()) ||
            (c.nachname.toLowerCase() === nachname.toLowerCase() &&
              c.vorname.toLowerCase() === wert(zeile, 'vorname').toLowerCase()),
        );
        if (doppelt) hinweise.push('Kontakt ist bereits im Projekt vorhanden');

        let zuordnungen: Zuordnung[] = [];
        if (funktion) {
          const rolle = rollen.find((r) => r.name.trim().toLowerCase() === funktion.toLowerCase());
          if (!rolle) hinweise.push(`Funktion „${funktion}“ ist im Projekt nicht hinterlegt`);
          else {
            const uebergreifend = !gewerk || gewerk.toLowerCase() === UEBERGREIFEND.toLowerCase();
            if (!uebergreifend && rolle.gewerke.length > 0 && !rolle.gewerke.includes(gewerk)) {
              hinweise.push(`„${funktion}“ ist für ${gewerk} nicht hinterlegt`);
            }
            zuordnungen = [{ roleId: rolle.id, gewerk: uebergreifend ? null : gewerk }];
          }
        }

        return {
          kontakt: {
            projectId: project.id,
            anrede: wert(zeile, 'anrede'),
            vorname: wert(zeile, 'vorname'),
            nachname: wert(zeile, 'nachname'),
            firma: wert(zeile, 'firma'),
            email: wert(zeile, 'email'),
            telefon: wert(zeile, 'telefon'),
            anschrift: anschriftBauen(
              wert(zeile, 'strasse'),
              wert(zeile, 'hausnummer'),
              wert(zeile, 'plz'),
              wert(zeile, 'ort'),
            ),
            zuordnungen,
            notiz: wert(zeile, 'notiz'),
          },
          hinweis: hinweise.join('; '),
        };
      });

      setVorschau(ergebnis.filter((e) => e.kontakt.nachname));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const uebernehmen = () => {
    vorschau.forEach((v) => addContact(v.kontakt));
    toast(`${vorschau.length} Kontakte übernommen.`);
    onClose();
  };

  const mitHinweis = vorschau.filter((v) => v.hinweis).length;

  return (
    <Modal
      titel="Kontakte aus Excel einlesen"
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
            {vorschau.length > 0 ? `${vorschau.length} Kontakte übernehmen` : 'Übernehmen'}
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
            Erwartete Spalten: <strong>{KOPFZEILE.join(' · ')}</strong>. Zwingend ist nur <strong>Name</strong>;
            Straße, Nr., PLZ und Ort werden zur Anschrift zusammengefasst. Gewerk und Funktion werden nach dem
            Import je Kontakt zugewiesen – stehen sie als zusätzliche Spalten in der Liste, werden sie
            übernommen. Über <em>Vorlage</em> erhalten Sie eine Datei mit genau diesen Spalten.
          </Callout>
        ) : null}

        {vorschau.length > 0 ? (
          <>
            {mitHinweis > 0 ? (
              <Callout ton="warn" icon="!">
                {mitHinweis} Zeile(n) mit Hinweisen – die Kontakte werden trotzdem übernommen, die Funktion ist
                dann aber nicht zugeordnet.
              </Callout>
            ) : null}
            <div className="card" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Firma</th>
                    <th>Anschrift</th>
                    <th>E-Mail</th>
                    <th>Hinweis</th>
                  </tr>
                </thead>
                <tbody>
                  {vorschau.map((v, i) => {
                    const rolle = rollen.find((r) => r.id === v.kontakt.zuordnungen[0]?.roleId);
                    return (
                      <tr key={i}>
                        <td>
                          <strong>
                            {v.kontakt.vorname} {v.kontakt.nachname}
                          </strong>
                        </td>
                        <td className="small muted">{v.kontakt.firma}</td>
                        <td className="small muted">
                          {v.kontakt.anschrift ? v.kontakt.anschrift.replace(/\n/g, ', ') : '–'}
                          {rolle ? (
                            <div className="tertiary small">
                              {v.kontakt.zuordnungen[0]?.gewerk ?? UEBERGREIFEND} · {rolle.name}
                            </div>
                          ) : null}
                        </td>
                        <td className="small muted">{v.kontakt.email}</td>
                        <td className="small" style={{ color: v.hinweis ? 'var(--orange)' : undefined }}>
                          {v.hinweis || '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
