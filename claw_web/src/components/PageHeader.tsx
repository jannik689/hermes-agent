import { cn } from '../lib/cn'

export function PageHeader({
  title,
  description,
  right,
  className,
}: {
  title: string
  description?: string
  right?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-b border-zinc-200/80 bg-white px-7 py-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-[26px] font-semibold tracking-tight text-zinc-900">
            {title}
          </div>
          {description && (
            <div className="mt-1 text-sm leading-6 text-zinc-500">
              {description}
            </div>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  )
}

