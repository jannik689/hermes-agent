import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import type { RunState } from '../types/protocol'

export function RunCard({
  run,
  onApprovalDecision,
}: {
  run: RunState
  onCancel?: (runId: string) => void
  onApprovalDecision?: (approvalId: string, decision: 'approved' | 'denied') => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const pendingApproval = useMemo(() => {
    if (!run.approval) return null
    return run.approval.status === 'pending' ? run.approval : null
  }, [run.approval])

  if (!pendingApproval && (!run.steps || run.steps.length === 0) && (!run.artifacts || run.artifacts.length === 0)) {
    return null
  }

  return (
    <div className="px-2 py-1 text-xs text-zinc-500">
      {!!pendingApproval && (
        <div className="rounded-2xl border border-indigo-200/60 bg-indigo-50/70 px-4 py-3">
          <div className="text-xs font-semibold text-indigo-900">需要审批</div>
          <div className="mt-1 text-xs leading-5 text-indigo-800/80">
            {pendingApproval.reason}
          </div>
          {!!pendingApproval.proposal?.path && (
            <div className="mt-2 text-[11px] text-indigo-800/70">
              {pendingApproval.scope} · {pendingApproval.proposal.path}
            </div>
          )}
          {!!pendingApproval.proposal?.preview && (
            <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-5 text-indigo-900/80">
              {pendingApproval.proposal.preview}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onApprovalDecision?.(pendingApproval.approvalId, 'approved')}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-zinc-800"
            >
              允许
            </button>
            <button
              type="button"
              onClick={() => onApprovalDecision?.(pendingApproval.approvalId, 'denied')}
              className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-indigo-900 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100/60"
            >
              拒绝
            </button>
          </div>
        </div>
      )}

      {!!run.steps?.length && (
        <div className={cn("relative ml-1.5 space-y-4 border-l-[1.5px] border-zinc-200/60 pl-4 py-1", pendingApproval ? "mt-4" : "")}>
          {run.steps.map((s) => (
            <div key={s.id} className="relative">
              {/* Timeline Dot */}
              <div className="absolute -left-[21.5px] top-0.5 bg-white py-1">
                <div
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full',
                    s.status === 'succeeded' && 'text-emerald-500',
                    s.status === 'running' && 'text-amber-500',
                    s.status === 'blocked' && 'text-indigo-500',
                    s.status === 'failed' && 'text-rose-500',
                    s.status === 'cancelled' && 'text-zinc-400',
                    s.status === 'queued' && 'text-zinc-300',
                  )}
                >
                  {s.status === 'running' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : s.status === 'succeeded' ? (
                    s.name === '思考' ? <Brain className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : s.status === 'failed' ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : (
                    s.name === '思考' ? <Brain className="h-3.5 w-3.5" /> : <div className={cn("h-1.5 w-1.5 rounded-full", s.status === 'queued' ? 'bg-zinc-300' : 'bg-current')} />
                  )}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <button 
                    type="button"
                    onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                    className="flex items-center gap-1.5 text-left hover:opacity-80"
                  >
                    <span className="text-xs font-medium text-zinc-700">{s.name}</span>
                    {!!s.logs?.length && (
                      <ChevronDown className={cn("h-3.5 w-3.5 text-zinc-400 transition-transform", expanded[s.id] && "rotate-180")} />
                    )}
                  </button>
                  
                  {/* Expanded Content or Default Preview */}
                  {expanded[s.id] ? (
                    <div className="mt-2">
                      {s.name === '思考' ? (
                        <div className="text-[10px] leading-5 text-zinc-500 whitespace-pre-wrap rounded-lg">
                          {s.logs?.map(l => l.message).join('')}
                        </div>
                      ) : (
                        <div className="space-y-1.5 bg-zinc-50/80 rounded-lg p-2.5 border border-zinc-100/80 shadow-sm">
                          {s.logs?.map((l, i) => (
                            <div key={i} className="text-[10px] font-mono text-zinc-500 break-all leading-relaxed">
                              {l.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1">
                      {s.name === '思考' && s.logs?.length ? (
                        <div className="truncate text-[10px] text-zinc-400">
                           {s.logs[s.logs.length - 1].message}
                        </div>
                      ) : s.output?.preview ? (
                        <div className="truncate text-[11px] text-zinc-500">{s.output.preview}</div>
                      ) : s.logs?.length ? (
                        <div className="truncate text-[10px] font-mono text-zinc-400">{s.logs[s.logs.length - 1].message}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!!run.artifacts?.length && (
        <div className="mt-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-inset ring-zinc-200/60">
          <div className="text-xs font-semibold text-zinc-700">产物</div>
          <div className="mt-2 space-y-1.5">
            {run.artifacts.map((a) => (
              <a
                key={a.id}
                href={a.uri}
                className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{a.title}</div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                    {a.type}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
