/** Kleiner Dialog zum Anlegen eines weiteren Gewerks. */
import { useState } from 'react';
import { useStore } from '../store/store';
import { useToast } from './toast';
import { Field, Modal, TextInput } from './ui';

export function GewerkDialog({ onClose, onAngelegt }: { onClose: () => void; onAngelegt?: (name: string) => void }) {
  const { data, addGewerk } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');

  const speichern = () => {
    const wert = name.trim();
    if (!wert) {
      toast('Bitte eine Bezeichnung angeben.');
      return;
    }
    if (data.gewerke.some((g) => g.toLowerCase() === wert.toLowerCase())) {
      toast(`„${wert}“ ist bereits angelegt.`);
      return;
    }
    addGewerk(wert);
    toast(`Gewerk „${wert}“ angelegt.`);
    onAngelegt?.(wert);
    onClose();
  };

  return (
    <Modal
      titel="Neues Gewerk"
      sub="Gilt projektübergreifend und steht überall zur Auswahl"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={speichern}>
            Anlegen
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Bezeichnung" full hint="Kurzform wie KIB, LST oder OLA">
          <TextInput value={name} onChange={setName} placeholder="z.B. BÜ" onKeyDown={(e) => e.key === 'Enter' && speichern()} />
        </Field>
      </div>
      <p className="small tertiary" style={{ marginTop: 10 }}>
        Vorhanden: {data.gewerke.join(' · ')}
      </p>
    </Modal>
  );
}
