import {
  CheckCircle2,
  ChevronRight,
  Folder,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { workspaces } from '../data/mock'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'

const topNav = [
  { to: '/experts', label: '专家', icon: Users },
  { to: '/skills', label: '技能', icon: Sparkles },
  { to: '/automation', label: '自动化', icon: Zap },
]

function SideLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100',
          isActive && 'bg-zinc-100 text-zinc-900',
        )
      }
    >
      <Icon className="h-4 w-4 text-zinc-500" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-4 pb-2 text-[11px] font-medium tracking-wide text-zinc-500">
      {children}
    </div>
  )
}

function formatAge(ts: number) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  return `${day} 天前`
}

export function Sidebar({
  onOpenSettings,
}: {
  onOpenSettings: () => void
}) {
  const navigate = useNavigate()
  const sessionsById = useAppStore((s) => s.sessions)
  const tasksById = useAppStore((s) => s.tasks)
  const createSession = useAppStore((s) => s.createSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const fetchSessions = useAppStore((s) => s.fetchSessions)
  const [menu, setMenu] = useState<{ sessionId: string; top: number; left: number } | null>(
    null,
  )

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const sessions = useMemo(
    () =>
      Object.values(sessionsById)
        .filter((s) => s.status === 'active' || s.status === 'archived')
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [sessionsById],
  )

  return (
    <aside className="flex h-full w-80 flex-col border-r border-zinc-200/80 bg-white">
      <div className="flex items-center gap-3 border-b border-zinc-200/80 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
          TC
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-zinc-900">
              typeclaw
            </div>
            <div className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500">
              v0.1
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            placeholder="搜索会话"
          />
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={() => {
            const sessionId = createSession('新会话')
            navigate(`/sessions/${sessionId}`)
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <Plus className="h-4 w-4 text-zinc-500" />
          <span className="truncate">新会话</span>
        </button>

        {topNav.map((item) => (
          <SideLink key={item.label} {...item} />
        ))}
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-3 pb-2">
        <SectionTitle>会话</SectionTitle>
        {sessions.length === 0 ? (
          <div className="px-2.5 py-3 text-xs text-zinc-400">暂无会话</div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s, index) => {
              const task = tasksById[s.taskId]
              const Icon = CheckCircle2
              const iconColor = 'text-zinc-300'
              return (
                <NavLink
                  key={s.id || `session-${index}`}
                  to={`/sessions/${s.id}`}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-zinc-100',
                      isActive && 'bg-zinc-100',
                    )
                  }
                >
                  <Icon className={cn('mt-0.5 h-4 w-4', iconColor)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-zinc-800">
                      {task?.title ?? s.title}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">{formatAge(s.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                      setMenu({ sessionId: s.id, top: r.bottom + 6, left: r.right - 160 })
                    }}
                    className="ml-auto rounded-lg p-1.5 text-zinc-400 opacity-0 hover:bg-zinc-200/50 hover:text-zinc-700 group-hover:opacity-100"
                    aria-label="更多"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </NavLink>
              )
            })}
          </div>
        )}

        <SectionTitle>工作空间</SectionTitle>
        <div className="space-y-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Folder className="h-4 w-4 text-zinc-400" />
              <span className="truncate">{w.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-zinc-200 px-2 py-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          <Settings className="h-4 w-4 text-zinc-500" />
          <span className="truncate">设置</span>
        </button>
      </div>

      {!!menu && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setMenu(null)}
            aria-label="关闭"
          />
          <div
            className="absolute w-40 rounded-2xl border border-zinc-200/80 bg-white p-1 shadow-[0_30px_120px_rgba(0,0,0,0.18)]"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              type="button"
              onClick={() => {
                const id = menu.sessionId
                setMenu(null)
                deleteSession(id)
                navigate('/', { replace: true })
              }}
              className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
