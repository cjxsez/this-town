/**
 * NfcHint.tsx (kiosk-web): NFC icon + label pointing riders at the tag on the kiosk.
 *
 * Used on Idle ("Tap to play") and Mission ("Tap the tag to stamp"). The tag holds
 * https://<domain>/k/<car>?n=<nonce>; phone-web handles the tap, not this screen.
 *
 * TODO:
 * - Add an arrow pointing at where the tag physically sits on the enclosure.
 * - Gentle pulse animation so it reads as "do something" from across the car.
 */

interface NfcHintProps {
  label: string;
  size?: number;
}

export function NfcHint({ label, size = 72 }: NfcHintProps) {
  return (
    <div className="nfc-hint">
      <svg
        className="nfc-icon"
        width={size}
        height={size}
        viewBox="-6 0 76 64"
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <rect x="18" y="8" width="28" height="48" rx="5" />
        <path d="M8 24c-3 5-3 11 0 16" />
        <path d="M2 18c-5 9-5 19 0 28" />
        <path d="M56 24c3 5 3 11 0 16" />
        <path d="M62 18c5 9 5 19 0 28" />
      </svg>
      <span className="nfc-label">{label}</span>
    </div>
  );
}
