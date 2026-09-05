// Scannable QR for a payload string — used for the upi:// intent on a credited
// payment so the off-ramp can be shown by phone, not just as a link.
// Rendered as inline SVG (crisp at any projector size, no canvas/DPR issues).
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ value, size = 148, label }: { value: string; size?: number; label?: string }) {
  const [svg, setSvg] = useState<string>('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      // Medium ECC: still scans from a projected screen or a phone photo.
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((s) => { if (live) { setSvg(s); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [value]);

  if (failed) return null;
  return (
    <div className="qr" style={{ width: size }}>
      {/* qrcode emits a self-contained <svg>; sizing comes from the wrapper. */}
      <div className="qr-img" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      {label && <div className="qr-label">{label}</div>}
    </div>
  );
}
