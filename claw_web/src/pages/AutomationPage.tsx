import {
  Calendar,
  Clock,
  FileText,
  HelpCircle,
  Languages,
  Moon,
  Receipt,
  Stethoscope,
  Video,
  Plus,
  Play,
  Trash2,
  Settings2
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { PageHeader } from '../components/PageHeader'
import { automationTemplates } from '../data/mock'
import { hermesFetch } from '../lib/hermesApi'
import type { AutomationJob } from '../types/domain'
import { cn } from '../lib/cn'

const iconMap = [
  FileText,
  Languages,
  Moon,
  Receipt,
  Video,
  Calendar,
  HelpCircle,
  Clock,
  Stethoscope,
]

function CreateAutomationForm({ 
  onCancel, 
  onSuccess,
  initialName = '',
  initialPrompt = ''
}: { 
  onCancel: () => void, 
  onSuccess: () => void,
  initialName?: string,
  initialPrompt?: string
}) {
  const [name, setName] = useState(initialName)
  const [workspace, setWorkspace] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt)
  const [freqType, setFreqType] = useState<'daily' | 'interval' | 'once'>('daily')
  const [time, setTime] = useState('09:00')
  const [days, setDays] = useState<number[]>([1,2,3,4,5,6,0]) // 1-6 Mon-Sat, 0 Sun
  const [intervalVal, setIntervalVal] = useState('60')
  const [intervalUnit, setIntervalUnit] = useState('m')
  const [onceDate, setOnceDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit() {
    if (!name || !prompt) return
    setIsSubmitting(true)

    let schedule = ''
    if (freqType === 'daily') {
      const [h, m] = time.split(':')
      const daysStr = (days.length === 7 || days.length === 0) ? '*' : days.join(',')
      schedule = `${parseInt(m, 10)} ${parseInt(h, 10)} * * ${daysStr}`
    } else if (freqType === 'interval') {
      schedule = `every ${intervalVal}${intervalUnit}`
    } else if (freqType === 'once') {
      if (onceDate) {
        schedule = new Date(onceDate).toISOString()
      } else {
        // fallback if no date selected
        schedule = '30m'
      }
    }

    try {
      const res = await hermesFetch('/api/cron/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          prompt: workspace ? `[Workspace: ${workspace}]\n${prompt}` : prompt,
          schedule,
          deliver: 'local'
        })
      })
      if (res.ok) {
        onSuccess()
      } else {
        console.error("Failed to create job")
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSubmitting(false)
    }
  }

  const dayLabels = [
    { value: 1, label: '周一' },
    { value: 2, label: '周二' },
    { value: 3, label: '周三' },
    { value: 4, label: '周四' },
    { value: 5, label: '周五' },
    { value: 6, label: '周六' },
    { value: 0, label: '周日' },
  ]

  return (
    <div className="mx-auto w-full max-w-2xl bg-zinc-100 rounded-3xl p-8 my-8 shadow-sm border border-zinc-200/50">
      <h2 className="text-xl font-bold text-zinc-900 mb-8">添加自动化任务</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-2">名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：每日 AI 新闻推送"
            className="w-full rounded-xl border-none ring-1 ring-zinc-200 px-4 py-3 text-sm focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-2">工作空间 <span className="text-zinc-400 font-normal">（可选）</span></label>
          <div className="flex items-center rounded-xl bg-white ring-1 ring-zinc-200 px-4 py-3">
            <Plus className="h-5 w-5 text-zinc-400 mr-2" />
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="flex-1 border-none bg-transparent p-0 text-sm focus:ring-0"
              placeholder="选择工作空间..."
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-2">提示词</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="输入任务的具体指令..."
              className="w-full rounded-2xl border-none ring-1 ring-zinc-200 px-4 py-4 text-sm focus:ring-2 focus:ring-zinc-900 resize-none pb-12"
            />
            <div className="absolute bottom-3 left-4 flex gap-2">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200">
                <Settings2 className="h-3.5 w-3.5" />
                Auto
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200">
                <Settings2 className="h-3.5 w-3.5" />
                Skills
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-3">执行频率</label>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFreqType('daily')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", freqType === 'daily' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-900")}
            >
              每天
            </button>
            <button
              onClick={() => setFreqType('interval')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", freqType === 'interval' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-900")}
            >
              按间隔
            </button>
            <button
              onClick={() => setFreqType('once')}
              className={cn("px-4 py-2 rounded-full text-sm font-medium transition-colors", freqType === 'once' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-900")}
            >
              单次
            </button>
          </div>

          {freqType === 'daily' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-xl border-none ring-1 ring-zinc-200 bg-white pl-4 pr-10 py-2.5 text-sm font-medium focus:ring-2 focus:ring-zinc-900"
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dayLabels.map(d => {
                  const isActive = days.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      onClick={() => {
                        if (isActive) {
                          setDays(days.filter(v => v !== d.value))
                        } else {
                          setDays([...days, d.value])
                        }
                      }}
                      className={cn("px-3.5 py-2.5 rounded-full text-xs font-semibold transition-colors", isActive ? "bg-zinc-700 text-white" : "bg-zinc-200/50 text-zinc-600 hover:bg-zinc-200")}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {freqType === 'interval' && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-600">每隔</span>
              <input type="number" min="1" value={intervalVal} onChange={e => setIntervalVal(e.target.value)} className="w-20 rounded-xl border-none ring-1 ring-zinc-200 px-3 py-2 text-sm" />
              <select value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)} className="rounded-xl border-none ring-1 ring-zinc-200 px-3 py-2 text-sm bg-white">
                <option value="m">分钟</option>
                <option value="h">小时</option>
                <option value="d">天</option>
              </select>
            </div>
          )}

          {freqType === 'once' && (
            <div className="flex items-center gap-3">
              <input type="datetime-local" value={onceDate} onChange={e => setOnceDate(e.target.value)} className="rounded-xl border-none ring-1 ring-zinc-200 px-4 py-2.5 text-sm bg-white" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-2">生效日期区间 <span className="text-zinc-400 font-normal">（可选，留空表示始终生效。）</span></label>
          <input
            type="text"
            placeholder="选择生效日期"
            className="w-full rounded-xl border-none ring-1 ring-zinc-200 px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-zinc-900 text-zinc-400"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200/50">
          <button onClick={onCancel} className="px-6 py-2.5 rounded-full bg-zinc-200/50 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors">
            取消
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting || !name || !prompt} className="px-6 py-2.5 rounded-full bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors disabled:opacity-50">
            {isSubmitting ? '添加中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AutomationPage() {
  const [jobs, setJobs] = useState<AutomationJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<'list' | 'add' | 'templates'>('list')
  const [selectedTemplate, setSelectedTemplate] = useState<{name: string, prompt: string} | null>(null)

  const loadJobs = async () => {
    try {
      const res = await hermesFetch('/api/cron/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobs(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
  }, [])

  async function deleteJob(id: string) {
    if (!confirm('确定删除此自动化任务吗？')) return
    await hermesFetch(`/api/cron/jobs/${id}`, { method: 'DELETE' })
    loadJobs()
  }

  async function toggleJob(id: string, currentlyEnabled: boolean) {
    const action = currentlyEnabled ? 'pause' : 'resume'
    await hermesFetch(`/api/cron/jobs/${id}/${action}`, { method: 'POST' })
    loadJobs()
  }

  if (view === 'add') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-50 px-4">
        <CreateAutomationForm 
          initialName={selectedTemplate?.name}
          initialPrompt={selectedTemplate?.prompt}
          onCancel={() => {
            setView('list')
            setSelectedTemplate(null)
          }} 
          onSuccess={() => { 
            setView('list')
            setSelectedTemplate(null)
            loadJobs() 
          }} 
        />
      </div>
    )
  }

  const renderTemplates = () => (
    <>
      <div className="text-sm font-medium text-zinc-700">从模板入手</div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {automationTemplates.map((t, idx) => {
          const Icon = iconMap[idx % iconMap.length]
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTemplate({ name: t.title, prompt: t.description })
                setView('add')
              }}
              className="group flex items-start gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300/80 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 transition group-hover:bg-zinc-900 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">
                  {t.title}
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-500">
                  {t.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )

  if (view === 'templates') {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          title="自动化模版"
          description="选择一个模版快速开始。"
          right={
            <button
              type="button"
              onClick={() => setView('list')}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
            >
              返回列表
            </button>
          }
        />
        <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-8 py-8">
          <div className="mx-auto w-full max-w-5xl">
            {renderTemplates()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="自动化"
        description="管理自动化任务并查看近期运行记录。"
        right={
          <div className="flex items-center gap-3">
            {jobs.length > 0 && (
              <button
                type="button"
                onClick={() => setView('templates')}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              >
                从模版添加
              </button>
            )}
            <button
              type="button"
              onClick={() => setView('add')}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              + 添加
            </button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="mx-auto w-full max-w-5xl">
          {isLoading ? (
            <div className="py-20 text-center text-zinc-400">加载中...</div>
          ) : jobs.length > 0 ? (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-zinc-700 mb-6">已安排</div>
              {jobs.map(job => (
                <div key={job.id} className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 ring-1 ring-zinc-200/80 hover:ring-zinc-300 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleJob(job.id, job.enabled)}
                      className={cn("h-4 w-4 rounded-full border-2 transition-colors", job.enabled ? "border-emerald-500 bg-emerald-500/20" : "border-zinc-300 bg-zinc-100")} 
                      title={job.enabled ? "暂停" : "恢复"}
                    />
                    <div className="font-semibold text-sm text-zinc-900">{job.name}</div>
                    <div className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
                      automation-{job.id}
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                      {job.schedule_display}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-xs text-zinc-500">
                      {job.next_run_at ? (() => {
                        const next = new Date(job.next_run_at)
                        const diffH = Math.max(0, Math.floor((next.getTime() - Date.now()) / (1000 * 60 * 60)))
                        return `${diffH}小时后开始`
                      })() : '无安排'}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => hermesFetch(`/api/cron/jobs/${job.id}/trigger`, { method: 'POST' })} className="p-1.5 text-zinc-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50" title="立即触发">
                        <Play className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteJob(job.id)} className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="删除">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderTemplates()
          )}
        </div>
      </div>
    </div>
  )
}
