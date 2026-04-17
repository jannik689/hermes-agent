import { cn } from '../lib/cn'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900',
            o.value === value &&
              'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

