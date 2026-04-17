import { useEffect, useMemo, useState } from 'react'
import { Bot, Settings, Sparkles, Wrench, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { ModelSettings } from './ModelSettings'

type TabKey = 'settings' | 'services' | 'models' | 'channels'

const tabs: Array<{
  key: TabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { key: 'services', label: '服务', icon: Wrench },
  { key: 'models', label: '模型', icon: Sparkles },
  { key: 'channels', label: '渠道', icon: Bot },
  { key: 'settings', label: '设置', icon: Settings },
]

export function SettingsModal({
  open,
  onClose,
  defaultTab = 'settings',
}: {
  open: boolean
  onClose: () => void
  defaultTab?: TabKey
}) {
  const [mounted, setMounted] = useState(open)
  const [active, setActive] = useState(false)
  const [tab, setTab] = useState<TabKey>(defaultTab)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [defaultTab, open])

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setActive(true))
      return
    }
    setActive(false)
    const t = window.setTimeout(() => setMounted(false), 180)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mounted, onClose])

  const title = useMemo(() => {
    return tabs.find((t) => t.key === tab)?.label ?? '设置'
  }, [tab])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
        aria-label="关闭"
      />
      <div
        className={cn(
          'absolute left-1/2 top-1/2 w-[980px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-[0_35px_120px_rgba(0,0,0,0.25)] transition duration-200',
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]',
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-4">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          <button
            type="button"
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[620px] max-h-[calc(100dvh-8rem)]">
          <div className="w-56 border-r border-zinc-200/80 bg-white p-2">
            {tabs.map((t) => {
              const Icon = t.icon
              const active = t.key === tab
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100',
                    active && 'bg-zinc-100 text-zinc-900',
                  )}
                >
                  <Icon className="h-4 w-4 text-zinc-500" />
                  <span className="truncate">{t.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-zinc-50">
            {tab === 'models' ? (
              <ModelSettings />
            ) : (
              <div className="p-5">
                <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                  <div className="text-sm font-medium text-zinc-900">{title}</div>
                  <div className="mt-1 text-sm text-zinc-500">Coming soon</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
