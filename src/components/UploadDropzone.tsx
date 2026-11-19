import { useId, useState } from 'react';
import { FileUp } from 'lucide-react';
import { ScanningSheet } from './art';
import { cx } from './ui';

export function UploadDropzone({ onFile, busy, sem }: { onFile: (f: File) => void; busy: boolean; sem: number }) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cx(
        'press flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-5 py-7 text-center focus-within:border-pen',
        over ? 'border-pen bg-[color-mix(in_srgb,var(--pen)_8%,var(--sheet))]' : 'border-line-strong bg-surface/60 hover:border-fg',
        busy && 'pointer-events-none',
      )}
    >
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf,image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      {busy ? (
        <span aria-live="polite">
          <ScanningSheet progress={0.6} />
          <span className="mt-4 block text-[15.5px] font-semibold text-fg">Reading your result…</span>
          <span className="mt-1 block text-[13.5px] text-muted">On your phone. Nothing is uploaded.</span>
        </span>
      ) : (
        <>
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border-[1.5px] border-fg bg-marker text-on-marker shadow-[3px_3px_0_0_var(--offset)]">
            <FileUp size={24} aria-hidden="true" />
          </span>
          <span className="mt-4 font-display text-[19px] font-bold tracking-[-0.01em] text-fg">Add your Sem {sem} result</span>
          <span className="mt-1 max-w-xs text-[14px] leading-snug text-muted">A screenshot of the result page, or the DigiLocker PDF. Tap to choose it, or drag it here.</span>
        </>
      )}
    </label>
  );
}
