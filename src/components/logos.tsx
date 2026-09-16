/**
 * Bildmarken der Anwendung.
 *
 * Beide Marken sind als SVG nachgezeichnet, damit sie in jeder Größe scharf
 * bleiben und ohne zusätzliche Dateien auskommen. Soll die Originaldatei
 * verwendet werden, genügt es, sie unter `public/` abzulegen und die
 * jeweilige Komponente durch ein <img src="..."> zu ersetzen.
 */

/** Hausfarbe nach dem Logo Mailänder Consult. */
export const MARKE_BLAU = '#24456e';

/** App-Zeichen: zwei Blätter mit Prozesslinie – in der Seitenleiste. */
export function AppIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flex: 'none' }}
    >
      <rect width="64" height="64" rx="15" fill={MARKE_BLAU} />
      {/* hinteres Blatt */}
      <path
        d="M15 17h9M15 17v30h30v-7"
        stroke="#ffffff"
        strokeOpacity="0.45"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* vorderes Blatt mit umgeschlagener Ecke */}
      <path d="M21 10h16l12 12v31H21z" stroke="#ffffff" strokeWidth="4" strokeLinejoin="round" />
      <path d="M36.6 10.4V22.4h12" stroke="#ffffff" strokeWidth="3.6" strokeLinejoin="round" />
      {/* Prozesslinie */}
      <path
        d="M29 26v12h11"
        stroke="#ffffff"
        strokeOpacity="0.62"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#ffffff" fillOpacity="0.62">
        <circle cx="29" cy="26" r="4.2" />
        <circle cx="29" cy="38" r="4.2" />
        <circle cx="40" cy="38" r="4.2" />
      </g>
    </svg>
  );
}

/**
 * Wortmarke Mailänder Consult für die Kopfzeile. Der Schriftzug ist mit der
 * Systemschrift nachgestellt; das Zeichen rechts entspricht dem Original.
 */
export function MailaenderLogo({ height = 26 }: { height?: number }) {
  return (
    <svg
      width={(height * 250) / 62}
      height={height}
      viewBox="0 0 250 62"
      fill="none"
      role="img"
      aria-label="Mailänder Consult"
      style={{ display: 'block', flex: 'none' }}
    >
      <g
        fill={MARKE_BLAU}
        fontFamily="'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif"
        fontWeight="800"
        letterSpacing="-1"
      >
        <text x="0" y="26" fontSize="30">
          Mailänder
        </text>
        <text x="50" y="57" fontSize="30">
          Consult
        </text>
      </g>
      {/* Bildzeichen: zwei aufgeschlagene Seiten */}
      <g stroke={MARKE_BLAU} strokeWidth="6" fill="none">
        <path d="M188 5v52h27V30z" />
        <path d="M247 5v52h-27V30z" />
      </g>
    </svg>
  );
}
