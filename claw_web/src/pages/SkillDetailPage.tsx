import { ArrowLeft, Code2, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'
import { hermesFetch } from '../lib/hermesApi'

interface SkillDetail {
  success: boolean
  name: string
  content: string
  description: string
  enabled: boolean
}

export function SkillDetailPage() {
  const params = useParams()
  // React Router catch-all parses the * parameter into `*`
  const skillName = params['*'] || params.skillId
  const navigate = useNavigate()
  const toggleSkillEnabled = useAppStore((s) => s.toggleSkillEnabled)
  const skills = useAppStore((s) => s.skills)
  
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'preview' | 'text'>('preview')

  const storeSkill = skills.find(s => s.id === skillName)
  const isEnabled = storeSkill ? storeSkill.enabled : detail?.enabled

  useEffect(() => {
    if (!skillName) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    hermesFetch(`/api/skills/${encodeURIComponent(skillName)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load skill details')
        return res.json()
      })
      .then((data: SkillDetail) => {
        setDetail(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [skillName])

  const handleToggle = async () => {
    if (!skillName) return
    await toggleSkillEnabled(skillName)
    // local detail state is derived from store via `isEnabled`, so it will re-render automatically.
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        加载中...
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-zinc-500">
        <div>{error || '无法找到技能'}</div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          返回上一页
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50">
      {/* Header Area */}
      <div className="flex-none border-b border-zinc-200 bg-white px-8 py-6 shadow-sm">
        <div className="mx-auto w-full max-w-5xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>
          
          <div className="flex items-start justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-zinc-900">{detail.name}</h1>
              <p className="mt-3 text-base text-zinc-600">{detail.description}</p>
            </div>
            
            <button
              onClick={handleToggle}
              className={cn(
                "mt-1 shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition-colors",
                isEnabled 
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              {isEnabled ? '卸载' : '安装'}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-700">SKILL.md</div>
              <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
                <button
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1.5 transition-colors",
                    viewMode === 'preview' 
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5" 
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                  title="预览模式"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('text')}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1.5 transition-colors",
                    viewMode === 'text' 
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5" 
                      : "text-zinc-500 hover:text-zinc-700"
                  )}
                  title="文本查看模式"
                >
                  <Code2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Markdown / Raw Content */}
            <div className="p-6">
              {viewMode === 'preview' ? (
                <div className="prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-blue-600">
                  <ReactMarkdown>{detail.content}</ReactMarkdown>
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-xl bg-zinc-50 p-4 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200">
                  <code>{detail.content}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
