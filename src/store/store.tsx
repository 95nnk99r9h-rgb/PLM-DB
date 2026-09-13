/**
 * Zentraler Anwendungsstatus. Alle Schreibzugriffe laufen über diesen Store,
 * der den Bestand nach jeder Änderung lokal persistiert und die Soll-Termine
 * betroffener Planläufe neu berechnet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { recalcRun } from '../domain/engine';
import { seedData } from '../domain/seed';
import { ladeDaten, speichereDaten } from './storage';
import type {
  AppData,
  Contact,
  ID,
  PlanDocument,
  PlanRun,
  ProcessTemplate,
  Project,
  Role,
  RunStep,
} from '../domain/types';

export function newId(prefix = 'id'): ID {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface StoreValue {
  data: AppData;
  /* Projekte */
  addProject: (p: Omit<Project, 'id'>) => ID;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  /* Rollen */
  addRole: (r: Omit<Role, 'id'>) => ID;
  updateRole: (id: ID, patch: Partial<Role>) => void;
  deleteRole: (id: ID) => void;
  /* Kontakte */
  addContact: (c: Omit<Contact, 'id'>) => ID;
  updateContact: (id: ID, patch: Partial<Contact>) => void;
  deleteContact: (id: ID) => void;
  /* Dokumente */
  addDocument: (d: Omit<PlanDocument, 'id'>) => ID;
  updateDocument: (id: ID, patch: Partial<PlanDocument>) => void;
  deleteDocument: (id: ID) => void;
  /* Vorlagen */
  addTemplate: (t: Omit<ProcessTemplate, 'id'> & { id?: ID }) => ID;
  updateTemplate: (id: ID, patch: Partial<ProcessTemplate>) => void;
  deleteTemplate: (id: ID) => void;
  /* Planläufe */
  addRun: (r: Omit<PlanRun, 'id'>) => ID;
  updateRun: (id: ID, patch: Partial<PlanRun>) => void;
  deleteRun: (id: ID) => void;
  updateStep: (runId: ID, stepId: ID, patch: Partial<RunStep>) => void;
  addStep: (runId: ID, step: Omit<RunStep, 'id'>, position?: number) => void;
  deleteStep: (runId: ID, stepId: ID) => void;
  moveStep: (runId: ID, stepId: ID, richtung: -1 | 1) => void;
  /* Verwaltung */
  ersetzeDaten: (d: AppData) => void;
  zuruecksetzen: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => ladeDaten());
  const ersterRender = useRef(true);

  useEffect(() => {
    if (ersterRender.current) {
      ersterRender.current = false;
    }
    speichereDaten(data);
  }, [data]);

  /** Änderung anwenden und alle Läufe mit aktuellen Projekteinstellungen durchrechnen. */
  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    setData((alt) => {
      const neu = fn(alt);
      return {
        ...neu,
        runs: neu.runs.map((r) => recalcRun(r, neu.projects.find((p) => p.id === r.projectId))),
      };
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const upd = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x));

    return {
      data,

      addProject: (p) => {
        const id = newId('prj');
        mutate((d) => ({ ...d, projects: [...d.projects, { ...p, id }] }));
        return id;
      },
      updateProject: (id, patch) => mutate((d) => ({ ...d, projects: upd(d.projects, id, patch) })),
      deleteProject: (id) =>
        mutate((d) => ({
          ...d,
          projects: d.projects.filter((p) => p.id !== id),
          roles: d.roles.filter((r) => r.projectId !== id),
          contacts: d.contacts.filter((c) => c.projectId !== id),
          documents: d.documents.filter((x) => x.projectId !== id),
          runs: d.runs.filter((r) => r.projectId !== id),
          templates: d.templates.filter((t) => t.projectId !== id),
        })),

      addRole: (r) => {
        const id = newId('rol');
        mutate((d) => ({ ...d, roles: [...d.roles, { ...r, id }] }));
        return id;
      },
      updateRole: (id, patch) => mutate((d) => ({ ...d, roles: upd(d.roles, id, patch) })),
      deleteRole: (id) =>
        mutate((d) => ({
          ...d,
          roles: d.roles.filter((r) => r.id !== id),
          contacts: d.contacts.map((c) => ({ ...c, roleIds: c.roleIds.filter((r) => r !== id) })),
        })),

      addContact: (c) => {
        const id = newId('con');
        mutate((d) => ({ ...d, contacts: [...d.contacts, { ...c, id }] }));
        return id;
      },
      updateContact: (id, patch) => mutate((d) => ({ ...d, contacts: upd(d.contacts, id, patch) })),
      deleteContact: (id) =>
        mutate((d) => ({
          ...d,
          contacts: d.contacts.filter((c) => c.id !== id),
          documents: d.documents.map((x) =>
            x.verantwortlichContactId === id ? { ...x, verantwortlichContactId: null } : x,
          ),
          runs: d.runs.map((r) => ({
            ...r,
            steps: r.steps.map((s) => (s.contactId === id ? { ...s, contactId: null } : s)),
          })),
        })),

      addDocument: (doc) => {
        const id = newId('doc');
        mutate((d) => ({ ...d, documents: [...d.documents, { ...doc, id }] }));
        return id;
      },
      updateDocument: (id, patch) => mutate((d) => ({ ...d, documents: upd(d.documents, id, patch) })),
      deleteDocument: (id) =>
        mutate((d) => ({
          ...d,
          documents: d.documents
            .filter((x) => x.id !== id)
            .map((x) => (x.parentId === id ? { ...x, parentId: null } : x)),
          runs: d.runs.filter((r) => r.documentId !== id),
        })),

      addTemplate: (t) => {
        const id = t.id ?? newId('tpl');
        mutate((d) => ({ ...d, templates: [...d.templates, { ...t, id } as ProcessTemplate] }));
        return id;
      },
      updateTemplate: (id, patch) => mutate((d) => ({ ...d, templates: upd(d.templates, id, patch) })),
      deleteTemplate: (id) => mutate((d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id) })),

      addRun: (r) => {
        const id = newId('run');
        mutate((d) => ({ ...d, runs: [...d.runs, { ...r, id }] }));
        return id;
      },
      updateRun: (id, patch) => mutate((d) => ({ ...d, runs: upd(d.runs, id, patch) })),
      deleteRun: (id) => mutate((d) => ({ ...d, runs: d.runs.filter((r) => r.id !== id) })),

      updateStep: (runId, stepId, patch) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) =>
            r.id === runId ? { ...r, steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) } : r,
          ),
        })),

      addStep: (runId, step, position) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) => {
            if (r.id !== runId) return r;
            const neu = { ...step, id: newId('rs') };
            const steps = [...r.steps];
            steps.splice(position ?? steps.length, 0, neu);
            return { ...r, steps };
          }),
        })),

      deleteStep: (runId, stepId) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) => (r.id === runId ? { ...r, steps: r.steps.filter((s) => s.id !== stepId) } : r)),
        })),

      moveStep: (runId, stepId, richtung) =>
        mutate((d) => ({
          ...d,
          runs: d.runs.map((r) => {
            if (r.id !== runId) return r;
            const idx = r.steps.findIndex((s) => s.id === stepId);
            const ziel = idx + richtung;
            if (idx < 0 || ziel < 0 || ziel >= r.steps.length) return r;
            const steps = [...r.steps];
            [steps[idx], steps[ziel]] = [steps[ziel], steps[idx]];
            return { ...r, steps };
          }),
        })),

      ersetzeDaten: (d) => mutate(() => d),
      zuruecksetzen: () => mutate(() => seedData()),
    };
  }, [data, mutate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore muss innerhalb des StoreProvider verwendet werden.');
  return ctx;
}
