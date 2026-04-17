import {
  ChevronRight,
  MoreHorizontal,
  Search,
  Server,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'
import { McpManagerModal } from '../components/McpManagerModal'

type Tab = '推荐' | 'SkillHub' | '套件'

const categories = [
  '全部',
  '开发工具',
  '内容创作',
  '数据分析',
  '效率工具',
  '办公协同',
  '商业运营',
  '知识学习',
]

export function SkillsPage() {
  const [tab, setTab] = useState<Tab>('推荐')
  const [query, setQuery] = useState('')
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  
  const navigate = useNavigate()
  const skills = useAppStore((s) => s.skills)
  const toggleSkillEnabled = useAppStore((s) => s.toggleSkillEnabled)
  const refreshSkills = useAppStore((s) => s.refreshSkills)

  useEffect(() => {
    refreshSkills()
  }, [refreshSkills])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    )
  }, [query, skills])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <McpManagerModal open={mcpModalOpen} onClose={() => setMcpModalOpen(false)} />
      
      <PageHeader
        title="技能"
        description="安装、配置并管理你的工具能力。"
        right={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索技能"
                className="w-56 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              + 添加技能
            </button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-7 py-7">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              已安装
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                {skills.length}
              </span>
            </div>
            <button
              type="button"
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100"
              aria-label="更多"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-zinc-200/80 bg-gradient-to-b from-zinc-900 to-zinc-800 p-5 text-white shadow-sm lg:col-span-2 relative">
              <div className="flex items-start justify-between gap-6">
                <button
                  type="button"
                  className="flex items-start gap-4 text-left"
                  onClick={() => skills[0] && navigate(`/skills/${encodeURIComponent(skills[0].id)}`)}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                    S
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">
                      {skills[0]?.name ?? '暂无技能'}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-white/70">
                      {skills[0]?.description ?? '启动 Hermes dashboard 后自动加载技能列表。'}
                    </div>
                  </div>
                </button>

                {skills[0] && (
                  <button
                    type="button"
                    className={cn(
                      'rounded-2xl p-1 shrink-0 z-10',
                      skills[0].enabled ? 'text-emerald-300' : 'text-white/40',
                    )}
                    aria-label="开关"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSkillEnabled(skills[0].id)
                    }}
                  >
                    {skills[0].enabled ? (
                      <ToggleRight className="h-8 w-8" />
                    ) : (
                      <ToggleLeft className="h-8 w-8" />
                    )}
                  </button>
                )}
              </div>
              <button 
                type="button"
                onClick={() => skills[0] && navigate(`/skills/${encodeURIComponent(skills[0].id)}`)}
                className="mt-5 flex items-center gap-2 text-sm text-white/70 hover:text-white"
              >
                <span>查看详情</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {skills.slice(1, 3).map((s) => (
                <div
                  key={s.id}
                  className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:ring-1 hover:ring-zinc-200 transition-shadow cursor-pointer"
                  onClick={() => navigate(`/skills/${encodeURIComponent(s.id)}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                        {s.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {s.name}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
                          {s.description}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleSkillEnabled(s.id)
                      }}
                      className={cn('shrink-0', s.enabled ? 'text-emerald-500' : 'text-zinc-300')}
                      aria-label="开关"
                    >
                      {s.enabled ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['推荐', 'SkillHub', '套件'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium',
                      tab === t
                        ? 'bg-zinc-900 text-white'
                        : 'text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setMcpModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <Server className="h-4 w-4 text-zinc-500" />
                MCP 服务器
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700',
                    'hover:bg-zinc-200/70',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200/80">
              <div className="divide-y divide-zinc-100 bg-white">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate(`/skills/${encodeURIComponent(s.id)}`)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-zinc-50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                      {s.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-zinc-900">
                        {s.name}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
                        {s.description}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
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
