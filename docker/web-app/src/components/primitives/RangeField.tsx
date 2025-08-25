'use client';

export default function RangeField({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  unit,
  inputWidth = 'w-20',
}: {
  label: string;
  value: number;
  min?: number; max?: number; step?: number;
  onChange: (n: number) => void;
  unit?: string;
  inputWidth?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          className="w-full"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className={`${inputWidth} bg-zinc-900 border border-zinc-700 rounded px-2 py-1`}
          value={value}
          min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <span className="text-xs text-zinc-400">{unit}</span>}
      </div>
    </label>
  );
}
