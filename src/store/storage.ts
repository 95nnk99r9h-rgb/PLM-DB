/**
 * Lokale Persistenz im Browser (localStorage). Die Schnittstelle ist absichtlich
 * schmal gehalten, damit sie später gegen eine echte Datenbank-API getauscht
 * werden kann, ohne die Oberfläche anzufassen.
 */
import type { AppData } from '../domain/types';
import { seedData } from '../domain/seed';

const KEY = 'planlauf-management.data.v1';

export function ladeDaten(): AppData {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return seedData();
    const daten = JSON.parse(roh) as AppData;
    if (!daten || !Array.isArray(daten.projects)) return seedData();
    return daten;
  } catch {
    return seedData();
  }
}

export function speichereDaten(daten: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(daten));
  } catch (err) {
    console.warn('Daten konnten nicht lokal gespeichert werden:', err);
  }
}

export function loescheDaten(): void {
  localStorage.removeItem(KEY);
}

export function exportiereDaten(daten: AppData): void {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planlauf-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
