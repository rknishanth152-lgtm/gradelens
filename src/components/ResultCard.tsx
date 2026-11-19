import { forwardRef, useId, useRef, useState, type CSSProperties } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { useStore } from '../state/store';
import { fmt, roundHalfUp } from '../lib/grading';
import { LogoMark, PenCircle, Stamp } from './art';
import { Button, Card, Notice } from './ui';

interface CardData {
  name: string;
  reg: string;
  cgpa: number;
  sgpa: number;
  percentage: number;
}

/** Light-paper tokens pinned on the exported card, so the PNG looks the same from either theme. */
const PAPER_VARS = {
  '--sheet': '#ffffff',
  '--sheet-2': '#f7f9fc',
  '--rule': '#dde4f0',
  '--rule-strong': '#bfcadf',
  '--ink': '#121c3a',
  '--ink-2': '#45527a',
  '--ink-3': '#5c6990',
  '--pen': '#2347d9',
  '--pen-strong': '#2347d9',
  '--marker': '#ffe14a',
  '--marker-soft': 'rgba(255,225,74,.75)',
  '--margin': '#f0a3b0',
  '--pass': '#0e7a55',
} as CSSProperties;

const DESK = '#dfe5f1';

/** The exported "marks memo": 400×500 CSS px, rendered at 2.7× → 1080×1350. */
const ExportCard = forwardRef<HTMLDivElement, CardData>(function ExportCard({ name, reg, cgpa, sgpa, percentage }, ref) {
  return (
    <div ref={ref} style={{ ...PAPER_VARS, width: 400, height: 500, padding: 18, background: DESK, boxSizing: 'border-box', fontFamily: '"Work Sans", system-ui, sans-serif', color: '#121c3a' }}>
      <div
        style={{
          position: 'relative',
          height: '100%',
          borderRadius: 18,
          background: '#fff',
          boxShadow: '0 1px 0 rgba(18,28,58,.05), 0 16px 30px -18px rgba(18,28,58,.4)',
          backgroundImage: 'linear-gradient(to right, transparent 0 41px, #f0a3b0 41px 42.5px, transparent 42.5px), repeating-linear-gradient(to bottom, transparent 0 25px, #e6ebf4 25px 26px)',
          overflow: 'hidden',
          padding: '18px 20px 16px 58px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LogoMark size={26} />
            <span style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 17, letterSpacing: '-0.03em' }}>GradeLens</span>
          </div>
          <span style={{ fontFamily: 'Kalam, cursive', fontSize: 15, color: '#45527a' }}>marks memo</span>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{name || 'My result'}</div>
          <div style={{ fontSize: 12.5, color: '#45527a', marginTop: 3 }}>{reg ? `${reg}, ` : ''}B.Sc CT, SKASC</div>
        </div>

        {/* Tear line */}
        <div style={{ position: 'relative', margin: '16px -20px 0 -58px', borderTop: '2px dashed #bfcadf' }}>
          <span style={{ position: 'absolute', left: -9, top: -10, width: 18, height: 18, borderRadius: 99, background: DESK }} />
          <span style={{ position: 'absolute', right: -9, top: -10, width: 18, height: 18, borderRadius: 99, background: DESK }} />
        </div>

        <div style={{ marginTop: 18, fontSize: 13, color: '#45527a', fontWeight: 600 }}>CGPA after Sem 3</div>
        <div style={{ position: 'relative', alignSelf: 'flex-start', padding: '4px 18px', marginTop: 2 }}>
          <div style={{ position: 'absolute', inset: '-6px -10px', pointerEvents: 'none' }}>
            <PenCircle still className="h-full w-full" />
          </div>
          <span style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 76, lineHeight: 1, letterSpacing: '-0.05em' }}>{fmt(cgpa, 2)}</span>
        </div>
        <div style={{ fontSize: 12.5, color: '#45527a', marginTop: 8 }}>On the marksheet: {roundHalfUp(cgpa, 1).toFixed(1)}</div>

        <div style={{ display: 'flex', gap: 22, marginTop: 'auto', paddingBottom: 8 }}>
          {[
            ['Sem 3 SGPA', fmt(sgpa, 2)],
            ['Sem 3 percentage', `${fmt(percentage, 2)}%`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 12, color: '#45527a' }}>{k}</div>
              <div style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontWeight: 800, fontSize: 27, marginTop: 2, backgroundImage: 'linear-gradient(transparent 55%, rgba(255,225,74,.85) 55%, rgba(255,225,74,.85) 92%, transparent 92%)', padding: '0 3px' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: '#5c6990', borderTop: '1.5px dashed #dde4f0', paddingTop: 8 }}>Unofficial. Worked out with the college's counting rules.</div>
        <div style={{ position: 'absolute', right: 12, top: 150 }}>
          <Stamp top="WORKED OUT ON" bottom="GRADELENS" centre={roundHalfUp(cgpa, 1).toFixed(1)} size={96} color="#0e7a55" rotate={-12} />
        </div>
      </div>
    </div>
  );
});

export function ResultCardActions({ cgpa, sgpa, percentage, defaultName, defaultReg }: { cgpa: number; sgpa: number; percentage: number; defaultName: string; defaultReg: string }) {
  const { state, update } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const regId = useId();
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const name = state.cardName || defaultName;
  const reg = state.cardReg || defaultReg;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const render = async (): Promise<Blob> => {
    const { toBlob } = await import('html-to-image');
    await document.fonts?.ready;
    const blob = await toBlob(ref.current!, { pixelRatio: 2.7, cacheBust: true });
    if (!blob) throw new Error('render failed');
    return blob;
  };

  const fileName = `GradeLens-${(reg || 'result').replace(/[^A-Za-z0-9]/g, '')}.png`;

  const download = async () => {
    setBusy('dl');
    setMsg(null);
    try {
      const blob = await render();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      setMsg("The image didn't save. A screenshot of the card works too.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    setMsg(null);
    const text = `CGPA after Sem 3: ${fmt(cgpa, 2)}. Sem 3 SGPA ${fmt(sgpa, 2)}, ${fmt(percentage, 2)}%. Worked out on GradeLens.`;
    try {
      const blob = await render();
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else await navigator.share({ text, url: location.origin });
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') setMsg("Sharing isn't available here. Save the image and send it on WhatsApp.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[21px] font-bold tracking-[-0.01em] text-fg">Send it to the group</h2>
      <p className="mt-1 text-[14.5px] text-muted">A marks memo made on your phone, sized for WhatsApp status.</p>
      <div className="mt-5 grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="mx-auto w-[280px] overflow-hidden rounded-[18px] md:mx-0" style={{ height: 350 }} aria-hidden="true">
          <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left', width: 400 }}>
            <ExportCard ref={ref} name={name} reg={reg} cgpa={cgpa} sgpa={sgpa} percentage={percentage} />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-[13.5px] font-medium text-muted">
              Name on the memo
            </label>
            <input id={nameId} name="memo-name" className="field" autoComplete="off" maxLength={40} placeholder="Your name…" value={name} onChange={(e) => update((s) => ({ ...s, cardName: e.target.value }))} />
          </div>
          <div>
            <label htmlFor={regId} className="mb-1.5 block text-[13.5px] font-medium text-muted">
              Register number (optional)
            </label>
            <input id={regId} name="memo-reg" className="field uppercase" autoComplete="off" spellCheck={false} maxLength={12} placeholder="25BCT0…" value={reg} onChange={(e) => update((s) => ({ ...s, cardReg: e.target.value.toUpperCase() }))} />
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={download} disabled={busy != null} className="flex-1">
              {busy === 'dl' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
              {busy === 'dl' ? 'Making the image…' : 'Save image'}
            </Button>
            {canShare && (
              <Button variant="secondary" onClick={share} disabled={busy != null} className="flex-1">
                {busy === 'share' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                Share
              </Button>
            )}
          </div>
          {msg && <Notice tone="warn">{msg}</Notice>}
        </div>
      </div>
    </Card>
  );
}
