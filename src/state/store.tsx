import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppState } from '../domain/types';
import { leererZustand } from './leer';

const SPEICHER_SCHLUESSEL = 'nebenkostenabrechnung.state.v1';

export const AKTUELLE_VERSION = 1;

function ladeZustand(): AppState {
  if (typeof localStorage === 'undefined') return leererZustand();
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (!roh) return leererZustand();
    const geladen = JSON.parse(roh) as AppState;
    return migriere(geladen);
  } catch {
    return leererZustand();
  }
}

/** Ergänzt fehlende Felder, damit ältere Speicherstände weiterverwendet werden können. */
export function migriere(zustand: Partial<AppState>): AppState {
  const basis = leererZustand();
  return {
    ...basis,
    ...zustand,
    version: AKTUELLE_VERSION,
    objekt: { ...basis.objekt, ...zustand.objekt, vermieter: { ...basis.objekt.vermieter, ...zustand.objekt?.vermieter } },
    einheiten: zustand.einheiten ?? [],
    mietverhaeltnisse: (zustand.mietverhaeltnisse ?? []).map((m) => ({
      ...m,
      personenzahlen: m.personenzahlen ?? [],
      mieter: m.mieter ?? [],
    })),
    abrechnungszeitraeume: zustand.abrechnungszeitraeume ?? [],
    kostenpositionen: zustand.kostenpositionen ?? [],
    verbraeuche: zustand.verbraeuche ?? [],
    leerstandsverbraeuche: zustand.leerstandsverbraeuche ?? [],
    heizkosten: zustand.heizkosten ?? [],
  };
}

interface StoreWert {
  state: AppState;
  /** Ändert den Zustand über eine Aktualisierungsfunktion. */
  update: (fn: (entwurf: AppState) => AppState) => void;
  ersetze: (zustand: AppState) => void;
  zuruecksetzen: () => void;
}

const StoreContext = createContext<StoreWert | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(ladeZustand);

  useEffect(() => {
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(state));
    } catch {
      // Speicherplatz erschöpft o. Ä. – die Anwendung bleibt trotzdem benutzbar.
    }
  }, [state]);

  const update = useCallback((fn: (entwurf: AppState) => AppState) => {
    setState((alt) => fn(alt));
  }, []);

  const ersetze = useCallback((zustand: AppState) => setState(migriere(zustand)), []);
  const zuruecksetzen = useCallback(() => setState(leererZustand()), []);

  const wert = useMemo(
    () => ({ state, update, ersetze, zuruecksetzen }),
    [state, update, ersetze, zuruecksetzen],
  );

  return <StoreContext.Provider value={wert}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreWert {
  const wert = useContext(StoreContext);
  if (!wert) throw new Error('useStore muss innerhalb des StoreProvider verwendet werden.');
  return wert;
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export function exportiereJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importiereJson(text: string): AppState {
  const daten = JSON.parse(text) as Partial<AppState>;
  if (!daten || typeof daten !== 'object') {
    throw new Error('Die Datei enthält keine gültigen Abrechnungsdaten.');
  }
  return migriere(daten);
}
