import { useEffect, useState, type ReactNode } from 'react';
import { centZuEuroString, parseDezimal, parseEuroZuCent } from '../domain/util';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Karte({
  titel,
  beschreibung,
  aktion,
  children,
}: {
  titel?: string;
  beschreibung?: ReactNode;
  aktion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="karte">
      {(titel || aktion) && (
        <header className="karte-kopf">
          <div>
            {titel && <h2>{titel}</h2>}
            {beschreibung && <p className="beschreibung">{beschreibung}</p>}
          </div>
          {aktion}
        </header>
      )}
      {children}
    </section>
  );
}

export function Raster({ spalten = 2, children }: { spalten?: number; children: ReactNode }) {
  return (
    <div className="raster" style={{ gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

export function Feld({
  label,
  hinweis,
  breit,
  children,
}: {
  label: string;
  hinweis?: ReactNode;
  breit?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`feld${breit ? ' feld-breit' : ''}`}>
      <span className="feld-label">{label}</span>
      {children}
      {hinweis && <span className="feld-hinweis">{hinweis}</span>}
    </label>
  );
}

export function Hinweisbox({
  art = 'info',
  titel,
  children,
}: {
  art?: 'info' | 'warnung' | 'fehler' | 'erfolg';
  titel?: string;
  children: ReactNode;
}) {
  return (
    <div className={`hinweisbox hinweisbox-${art}`}>
      {titel && <strong>{titel}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function LeerZustand({ text }: { text: string }) {
  return <p className="leer">{text}</p>;
}

// ---------------------------------------------------------------------------
// Eingabefelder
// ---------------------------------------------------------------------------

export function TextEingabe({
  wert,
  onChange,
  platzhalter,
  typ = 'text',
}: {
  wert: string;
  onChange: (w: string) => void;
  platzhalter?: string;
  typ?: string;
}) {
  return (
    <input
      type={typ}
      value={wert}
      placeholder={platzhalter}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DatumEingabe({ wert, onChange }: { wert: string; onChange: (w: string) => void }) {
  return <input type="date" value={wert ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

function dezimalZuText(wert: number): string {
  return Number.isFinite(wert) ? String(wert).replace('.', ',') : '';
}

/**
 * Eingabefeld für Geldbeträge. Intern wird der Text gehalten, damit
 * Zwischenzustände wie "12," während der Eingabe erhalten bleiben.
 */
export function EuroEingabe({
  wert,
  onChange,
  platzhalter = '0,00',
}: {
  wert: number;
  onChange: (cent: number) => void;
  platzhalter?: string;
}) {
  const [text, setText] = useState(() => centZuEuroString(wert));
  const [aktiv, setAktiv] = useState(false);

  useEffect(() => {
    if (!aktiv) setText(centZuEuroString(wert));
  }, [wert, aktiv]);

  return (
    <div className="eingabe-mit-einheit">
      <input
        inputMode="decimal"
        value={text}
        placeholder={platzhalter}
        onFocus={() => setAktiv(true)}
        onBlur={() => {
          setAktiv(false);
          setText(centZuEuroString(wert));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseEuroZuCent(e.target.value));
        }}
      />
      <span className="einheit">€</span>
    </div>
  );
}

export function ZahlEingabe({
  wert,
  onChange,
  einheit,
  platzhalter = '0',
}: {
  wert: number;
  onChange: (w: number) => void;
  einheit?: string;
  platzhalter?: string;
}) {
  const [text, setText] = useState(() => dezimalZuText(wert));
  const [aktiv, setAktiv] = useState(false);

  useEffect(() => {
    if (!aktiv) setText(dezimalZuText(wert));
  }, [wert, aktiv]);

  return (
    <div className="eingabe-mit-einheit">
      <input
        inputMode="decimal"
        value={text}
        placeholder={platzhalter}
        onFocus={() => setAktiv(true)}
        onBlur={() => {
          setAktiv(false);
          setText(dezimalZuText(wert));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseDezimal(e.target.value));
        }}
      />
      {einheit && <span className="einheit">{einheit}</span>}
    </div>
  );
}

export function Auswahl<T extends string>({
  wert,
  onChange,
  optionen,
}: {
  wert: T;
  onChange: (w: T) => void;
  optionen: { wert: T; label: string; deaktiviert?: boolean }[];
}) {
  return (
    <select value={wert} onChange={(e) => onChange(e.target.value as T)}>
      {optionen.map((o) => (
        <option key={o.wert} value={o.wert} disabled={o.deaktiviert}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Schalter({
  wert,
  onChange,
  label,
  hinweis,
}: {
  wert: boolean;
  onChange: (w: boolean) => void;
  label: string;
  hinweis?: ReactNode;
}) {
  return (
    <label className="schalter">
      <input type="checkbox" checked={wert} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hinweis && <span className="feld-hinweis">{hinweis}</span>}
      </span>
    </label>
  );
}

export function Knopf({
  onClick,
  children,
  art = 'normal',
  typ = 'button',
  titel,
}: {
  onClick?: () => void;
  children: ReactNode;
  art?: 'normal' | 'primaer' | 'gefahr' | 'leise';
  typ?: 'button' | 'submit';
  titel?: string;
}) {
  return (
    <button type={typ} className={`knopf knopf-${art}`} onClick={onClick} title={titel}>
      {children}
    </button>
  );
}
