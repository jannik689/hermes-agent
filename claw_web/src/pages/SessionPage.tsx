import { Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChatComposer } from '../components/ChatComposer'
import { RunCard } from '../components/RunCard'
import { useAppStore } from '../store/appStore'
import type { RunState, StreamEvent } from '../types/protocol'
import { hermesFetch, getHermesSessionToken } from '../lib/hermesApi'

export function SessionPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const session = useAppStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  const task = useAppStore((s) => (session ? s.tasks[session.taskId] : undefined))
  const messageIds = useAppStore((s) =>
    sessionId ? s.sessions[sessionId]?.messageIds ?? [] : [],
  )
  const messagesById = useAppStore((s) => s.messages)
  const messages = useMemo(
    () => messageIds.map((id) => messagesById[id]).filter(Boolean),
    [messageIds, messagesById],
  )
  const runs = useAppStore((s) => s.runs)
  const addMessage = useAppStore((s) => s.addMessage)
  const attachRun = useAppStore((s) => s.attachRun)
  const updateRun = useAppStore((s) => s.updateRun)
  const upsertRunStep = useAppStore((s) => s.upsertRunStep)
  const appendRunLog = useAppStore((s) => s.appendRunLog)
  const addRunArtifact = useAppStore((s) => s.addRunArtifact)
  const setRunApproval = useAppStore((s) => s.setRunApproval)
  const createSession = useAppStore((s) => s.createSession)
  const fetchSessionMessages = useAppStore((s) => s.fetchSessionMessages)

  const sourcesRef = useRef<Record<string, EventSource>>({})
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (sessionId) {
      setActiveSessionId(sessionId)
      fetchSessionMessages(sessionId)
    }
  }, [setActiveSessionId, sessionId, fetchSessionMessages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, runs])

  useEffect(() => {
    return () => {
      Object.values(sourcesRef.current).forEach((s) => s.close())
      sourcesRef.current = {}
    }
  }, [])

  if (!session || !task) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <div className="text-sm text-zinc-500">会话不存在</div>
      </div>
    )
  }

  const sid = session.id

  const activeRun = messages
    .filter((m) => m?.kind === 'run')
    .map((m) => runs[(m as any).runId])
    .find((r) => r && (r.status === 'queued' || r.status === 'running' || r.status === 'blocked'))

  const isProcessing = !!activeRun

  async function createDemoRun(prompt: string, sessionId: string) {
    const resp = await hermesFetch('/api/v1/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, sessionId }),
    })
    if (!resp.ok) {
      throw new Error(`Failed to create run: ${resp.status}`)
    }
    const data = await resp.json()
    return data.id
  }

  async function connectRun(runId: string) {
    const token = await getHermesSessionToken()
    const src = new EventSource(`/api/v1/runs/${runId}/events?token=${token}`)
    sourcesRef.current[runId] = src

    const handlers = [
      'run.created',
      'run.updated',
      'run.step.created',
      'run.step.updated',
      'run.log.appended',
      'run.artifact.created',
      'approval.requested',
      'approval.decided',
      'run.chunk',
      'run.finished',
    ] as const

    handlers.forEach((t) => {
      src.addEventListener(t, (evt) => {
        const ev = JSON.parse((evt as MessageEvent).data) as StreamEvent<any>
        handleRunEvent(runId, ev.type, ev.payload)
        if (ev.type === 'run.finished') {
          src.onerror = null
          src.close()
          delete sourcesRef.current[runId]
        }
      })
    })

    src.onerror = () => {
      src.onerror = null
      src.close()
      delete sourcesRef.current[runId]
      
      // Only set to failed if it hasn't been completed yet
      const currentRun = useAppStore.getState().runs[runId]
      if (currentRun && currentRun.status !== 'succeeded' && currentRun.status !== 'failed') {
        updateRun(runId, { status: 'failed' } as Partial<RunState>)
      }
    }
  }

  function handleRunEvent(runId: string, type: string, payload: any) {
    if (type === 'run.updated') {
      updateRun(runId, { status: payload.status } as Partial<RunState>)
      return
    }
    if (type === 'run.chunk') {
      // Append streaming text to the run's streamingText property
      updateRun(runId, {
        streamingText: (useAppStore.getState().runs[runId]?.streamingText || '') + (payload.chunk || '')
      } as Partial<RunState>)
      return
    }
    if (type === 'run.step.created') {
      upsertRunStep(runId, payload.step)
      return
    }
    if (type === 'run.step.updated') {
      upsertRunStep(runId, payload.step)
      return
    }
    if (type === 'run.log.appended') {
      appendRunLog(runId, payload.stepId, payload.log)
      return
    }
    if (type === 'run.artifact.created') {
      addRunArtifact(runId, payload.artifact)
      return
    }
    if (type === 'approval.requested') {
      setRunApproval(runId, {
        approvalId: payload.approvalId,
        scope: payload.scope,
        reason: payload.reason,
        proposal: payload.proposal,
        status: 'pending',
      })
      updateRun(runId, { status: 'blocked' } as Partial<RunState>)
      return
    }
    if (type === 'approval.decided') {
      const decision = payload.decision as 'approved' | 'denied'
      const prevApproval = useAppStore.getState().runs[runId]?.approval
      if (prevApproval) {
        setRunApproval(runId, {
          ...prevApproval,
          status: decision === 'approved' ? 'approved' : 'denied',
        })
      }
      updateRun(runId, { status: decision === 'approved' ? 'running' : 'failed' } as Partial<RunState>)
      return
    }
    if (type === 'run.finished') {
      updateRun(runId, { status: payload.status, finalText: payload.finalText } as Partial<RunState>)
      if (payload.finalText) {
        addMessage(sid, { kind: 'assistant', text: payload.finalText } as any)
      }
    }
  }

  async function send(input: { text: string }) {
    addMessage(sid, { kind: 'user', text: input.text } as any)

    try {
      const runId = await createDemoRun(input.text, sid)
      const run: RunState = { runId, status: 'queued', steps: [], artifacts: [] }
      attachRun(sid, run)
      await connectRun(runId)
    } catch (e: any) {
      addMessage(sid, { kind: 'assistant', text: `执行失败: ${e.message}` } as any)
    }
  }

  async function cancelRun(runId: string) {
    if (sourcesRef.current[runId]) {
      sourcesRef.current[runId].onerror = null
      sourcesRef.current[runId].close()
      delete sourcesRef.current[runId]
    }
    
    updateRun(runId, { status: 'cancelled' } as Partial<RunState>)
    
    try {
      await hermesFetch(`/api/v1/runs/${runId}/cancel`, { method: 'POST' })
    } catch (e) {
      console.error("Failed to notify backend about cancellation", e)
    }
  }

  async function approvalDecision(approvalId: string, decision: 'approved' | 'denied') {
    await hermesFetch(`/api/v1/approvals/${approvalId}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-zinc-200/80 bg-white px-7 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="truncate text-[20px] font-semibold tracking-tight text-zinc-900">
              {task.title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <div className="rounded-full bg-zinc-100 px-2 py-1">会话</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const id = createSession('新会话')
                navigate(`/sessions/${id}`)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800"
            >
                <Plus className="h-4 w-4" />
                新会话
              </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-zinc-50">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {messages.map((m) => {
              if (!m) return null
              if (m.kind === 'run') {
                const run = runs[m.runId]
                if (!run) return null
                
                const isProcessing = run.status === 'queued' || run.status === 'running'
                
                return (
                  <div key={m.id} className="space-y-3">
                    <RunCard
                      run={run}
                      onCancel={cancelRun}
                      onApprovalDecision={approvalDecision}
                    />
                    
                    {/* Render streaming text if it exists and run is not finished */}
                    {isProcessing && run.streamingText && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-white px-5 py-4 text-sm leading-7 text-zinc-800 shadow-sm">
                          {run.streamingText}
                          <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-middle"></span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              if (m.kind === 'assistant') {
                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-white px-5 py-4 text-sm leading-7 text-zinc-800 shadow-sm">
                      {m.text}
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} className="flex justify-end group">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (activeRun) {
                          await cancelRun(activeRun.runId)
                        }
                        await send({ text: m.text })
                      }}
                      title="重新发送此消息"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-full"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-zinc-900 px-5 py-4 text-sm leading-7 text-white shadow-sm">
                      {m.text}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-zinc-200/80 bg-white px-6 py-5">
          <ChatComposer 
            className="mx-auto max-w-4xl" 
            onSend={send} 
            isProcessing={isProcessing}
            onCancel={() => activeRun && cancelRun(activeRun.runId)}
          />
          <div className="mx-auto mt-3 max-w-4xl text-xs text-zinc-400">Ctrl/⌘ + Enter 发送</div>
        </div>
      </div>
    </div>
  )
}
