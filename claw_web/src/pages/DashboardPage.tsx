import { ArrowRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mascot } from '../components/Mascot'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'

export function DashboardPage() {
  const navigate = useNavigate()
  const tasksById = useAppStore((s) => s.tasks)
  const tasks = useMemo(
    () => Object.values(tasksById).sort((a, b) => b.updatedAt - a.updatedAt),
    [tasksById],
  )
  const createSession = useAppStore((s) => s.createSession)
  const [title, setTitle] = useState('')

  const latest = useMemo(() => tasks[0], [tasks])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-zinc-200/80 bg-white px-7 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[26px] font-semibold tracking-tight text-zinc-900">
              任务
            </div>
            <div className="mt-1 text-sm leading-6 text-zinc-500">
              以任务为中心组织规划、执行与沉淀。
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const id = createSession('新会话')
              navigate(`/sessions/${id}`)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            新会话
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-7 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    快速开始
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    输入一句话，生成计划并进入执行。
                  </div>
                </div>
                <Mascot className="h-16 w-24 text-zinc-200" />
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：把会议纪要整理成行动项并写入 notes.md"
                  className="w-full bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const id = createSession(title.trim() ? title : '新会话')
                    setTitle('')
                    navigate(`/sessions/${id}`)
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm',
                    title.trim()
                      ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                      : 'bg-zinc-200 text-zinc-500',
                  )}
                  disabled={!title.trim()}
                >
                  开始
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {latest && (
                <button
                  type="button"
                  onClick={() => navigate(`/sessions/${tasksById[latest.id]?.activeSessionId ?? ''}`)}
                  className="mt-6 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-inset ring-zinc-200/80 hover:bg-zinc-50"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-zinc-500">
                      最近任务
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-zinc-900">
                      {latest.title}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </button>
              )}
            </div>

            <div className="rounded-[28px] border border-zinc-200/80 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">全部任务</div>
              <div className="mt-4 space-y-2">
                {tasks.slice(0, 8).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/sessions/${t.activeSessionId}`)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3 text-left hover:bg-zinc-100"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">
                        {t.title}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        对话
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
