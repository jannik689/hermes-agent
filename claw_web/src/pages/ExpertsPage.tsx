import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import type { ExpertCategory } from '../types/domain'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'

function Avatar({ name }: { name: string }) {
  const initials = name.slice(0, 1)
  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/60 ring-4 ring-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-xl font-semibold text-white">
        {initials}
      </div>
    </div>
  )
}

export function ExpertsPage() {
  const [category, setCategory] = useState<ExpertCategory>('all')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const experts = useAppStore((s) => s.experts)
  const categories = useAppStore((s) => s.expertCategories)
  const refreshExperts = useAppStore((s) => s.refreshExperts)
  const setDraftPrompt = useAppStore((s) => s.setDraftPrompt)

  useEffect(() => {
    refreshExperts()
  }, [refreshExperts])

  const filtered = useMemo(() => {
    const q = query.trim()
    const list = category === 'all' ? experts : experts.filter((e) => e.category === category)
    if (!q) return list
    return list.filter((e) => e.name.includes(q) || e.tag.includes(q) || e.description.includes(q))
  }, [category, query, experts])

  const handleSummon = (description: string) => {
    const state = useAppStore.getState()
    const draftSession = Object.values(state.sessions).find(s => s.status === 'draft')
    let targetId = draftSession?.id
    if (!targetId) {
      targetId = state.createSession('新会话')
    }
    setDraftPrompt(description)
    navigate(`/sessions/${targetId}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="专家中心"
        description="按行业分类浏览专家，召唤他们为你服务。"
        right={
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索专家职称或描述…"
              className="w-80 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>
        }
      />

      <div className="border-b border-zinc-200/80 bg-white px-7 py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-7">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                'text-sm font-medium',
                category === c.key
                  ? 'text-indigo-600'
                  : 'text-zinc-600 hover:text-zinc-900',
              )}
            >
              {c.label}
              {typeof c.count === 'number' && (
                <span className="ml-1 text-xs text-zinc-400">({c.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-7 py-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-300"
            >
              {/* Summon Overlay */}
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleSummon(e.description)}
                  className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 hover:scale-105 transition-all"
                >
                  + 立即召唤
                </button>
              </div>

              <div className="bg-indigo-50/50 px-4 py-5 text-center">
                <div className="scale-75 origin-top">
                  <Avatar name={e.name} />
                </div>
              </div>

              <div className="flex flex-1 flex-col px-5 pb-5 pt-2 text-center">
                <div className="text-base font-semibold text-zinc-900">{e.name}</div>
                <div className="mt-2">
                  <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
                    {e.tag}
                  </span>
                </div>
                <div className="mt-4 text-xs leading-5 text-zinc-500 line-clamp-3">
                  {e.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
