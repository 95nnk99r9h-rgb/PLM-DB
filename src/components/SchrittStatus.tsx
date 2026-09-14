/**
 * Gemeinsame Schrittaktionen für Planlauf und Übersichtslisten.
 *
 * `useSchrittStatus` kapselt den Statuswechsel samt Erfassung der Freigabe-
 * bzw. Prüfbericht-Nummer. Der zurückgegebene Dialog muss in der jeweiligen
 * Seite gerendert werden; `ErledigtButton` ist der kleine Haken, mit dem sich
 * der anstehende Schritt direkt aus einer Liste heraus erledigen lässt.
 */
import { useState } from 'react';
import { schrittStatusSetzen } from '../domain/abschluss';
import { NACHWEIS_LABEL, type PlanRun, type RunStep, type StepStatus } from '../domain/types';
import { useStore } from '../store/store';
import { useToast } from './toast';
import { Field, Modal, TextInput } from './ui';
import { Icon } from './icons';

export function useSchrittStatus() {
  const { updateRun, updateStep } = useStore();
  const toast = useToast();
  const [nachweisFuer, setNachweisFuer] = useState<{ run: PlanRun; step: RunStep } | null>(null);

  const setzeStatus = (run: PlanRun, step: RunStep, status: StepStatus, nachweisNummer?: string) => {
    const ergebnis = schrittStatusSetzen(run, step, status, nachweisNummer);
    if (ergebnis.art === 'nachweis') {
      setNachweisFuer({ run, step: ergebnis.step });
      return;
    }
    ergebnis.aenderungen.forEach((a) =>
      a.art === 'run' ? updateRun(run.id, a.patch) : updateStep(run.id, a.stepId, a.patch),
    );
    toast(ergebnis.meldung);
  };

  const nachweisDialog = nachweisFuer ? (
    <NachweisDialog
      step={nachweisFuer.step}
      onClose={() => setNachweisFuer(null)}
      onErfassen={(nummer) => setzeStatus(nachweisFuer.run, nachweisFuer.step, 'erledigt', nummer)}
    />
  ) : null;

  return { setzeStatus, nachweisDialog };
}

/** Haken zum direkten Erledigen eines anstehenden Schritts aus einer Liste. */
export function ErledigtButton({
  run,
  step,
  onErledigen,
}: {
  run: PlanRun;
  step: RunStep;
  onErledigen: (run: PlanRun, step: RunStep) => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-haken"
      title={`„${step.name}“ als erledigt vermerken`}
      aria-label="Schritt als erledigt vermerken"
      onClick={(e) => {
        e.stopPropagation();
        onErledigen(run, step);
      }}
    >
      <Icon name="check" size={13} />
    </button>
  );
}

/** Erfasst die Freigabe- bzw. Prüfbericht-Nummer beim Abschluss eines Schritts. */
export function NachweisDialog({
  step,
  onClose,
  onErfassen,
}: {
  step: RunStep;
  onClose: () => void;
  onErfassen: (nummer: string) => void;
}) {
  const toast = useToast();
  const [nummer, setNummer] = useState('');
  const bezeichnung = NACHWEIS_LABEL[step.nachweis];

  const uebernehmen = () => {
    if (!nummer.trim()) {
      toast(`Bitte die ${bezeichnung} angeben.`);
      return;
    }
    onErfassen(nummer.trim());
    onClose();
  };

  return (
    <Modal
      titel={`${bezeichnung} erfassen`}
      sub={`${step.name} – wird am Schritt und im Export dokumentiert`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={uebernehmen}>
            Übernehmen und erledigen
          </button>
        </>
      }
    >
      <Field label={bezeichnung}>
        <TextInput
          value={nummer}
          onChange={setNummer}
          autoFocus
          placeholder={step.nachweis === 'freigabe' ? 'z.B. FG-2026-0147' : 'z.B. PB-2026-0032'}
          onKeyDown={(e) => e.key === 'Enter' && uebernehmen()}
        />
      </Field>
    </Modal>
  );
}
