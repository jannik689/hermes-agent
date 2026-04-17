import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hermesFetch } from '../lib/hermesApi'
import type { ExpertCategoryInfo, ExpertItem, InstalledSkill, ChatMessage, Session, Task } from '../types/domain'
import type { RunState } from '../types/protocol'

interface StoreState {
  activeSessionId?: string
  tasks: Record<string, Task>
  sessions: Record<string, Session>
  messages: Record<string, ChatMessage>
  runs: Record<string, RunState>
  experts: ExpertItem[]
  expertCategories: ExpertCategoryInfo[]
  skills: InstalledSkill[]
  draftPrompt: string

  // MCP
  mcpServers: Record<string, any>
  mcpConfigPath: string
  mcpServerTools: Record<string, { loading: boolean; tools: string[]; error?: string }>

  // Models
  activeProvider: string
  activeModel: string
  modelProviders: any[]

  setActiveSessionId: (sessionId?: string) => void
  setDraftPrompt: (prompt: string) => void
  createSession: (title?: string) => string
  renameSession: (sessionId: string, title: string) => void
  setSessionExpert: (sessionId: string, expertId?: string) => void
  toggleSessionSkill: (sessionId: string, skillId: string) => void
  commitSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  refreshSkills: () => Promise<void>
  refreshExperts: () => Promise<void>
  fetchSessions: () => Promise<void>
  fetchSessionMessages: (sessionId: string) => Promise<void>

  addMessage: (sessionId: string, msg: Omit<ChatMessage, 'id' | 'createdAt'>) => string
  attachRun: (sessionId: string, run: RunState) => void
  updateRun: (runId: string, patch: Partial<RunState>) => void
  upsertRunStep: (runId: string, step: any) => void
  appendRunLog: (runId: string, stepId: string, log: { level: string; message: string }) => void
  addRunArtifact: (runId: string, artifact: any) => void
  setRunApproval: (runId: string, approval: any) => void

  toggleSkillEnabled: (skillId: string) => Promise<void>

  // MCP Actions
  refreshMcpServers: () => Promise<void>
  fetchMcpTools: (name: string) => Promise<void>
  toggleMcpServer: (name: string, enabled: boolean) => Promise<void>
  deleteMcpServer: (name: string) => Promise<void>
  saveMcpRaw: (jsonText: string) => Promise<void>

  // Models Actions
  refreshModels: () => Promise<void>
  updateProvider: (data: any) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
  setActiveModel: (provider: string, model: string) => Promise<void>
}

function _id(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
}

function _seedNow(): Pick<StoreState, 'tasks' | 'sessions' | 'messages'> {
  return { tasks: {}, sessions: {}, messages: {} }
}

const seed = _seedNow()

function _titleFromFirstUserText(text: string) {
  const t = text.trim()
  if (!t) return ''
  const candidates = ['\n', '。', '.', '!', '?', '！', '？']
  let cut = t.length
  for (const c of candidates) {
    const idx = t.indexOf(c)
    if (idx !== -1) cut = Math.min(cut, idx)
  }
  const first = t.slice(0, cut).trim()
  const max = 22
  if (first.length <= max) return first
  return `${first.slice(0, max)}…`
}

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => ({
      activeSessionId: undefined,
      tasks: seed.tasks,
      sessions: seed.sessions,
      messages: seed.messages,
      runs: {},
      experts: [],
      expertCategories: [],
      skills: [],
      draftPrompt: '',

      // MCP
      mcpServers: {},
      mcpConfigPath: '',
      mcpServerTools: {},

      // Models
      activeProvider: '',
      activeModel: '',
      modelProviders: [],

      setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
      setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),

      createSession: (title) => {
        const taskId = _id('t')
        const sessionId = _id('s')
        const now = Date.now()
        const finalTitle = title?.trim() ? title.trim() : '新会话'
        const t: Task = {
          id: taskId,
          title: finalTitle,
          selectedSkillIds: get().skills.filter((s) => s.enabled).map((s) => s.id),
          selectedExpertId: get().experts[0]?.id,
          activeSessionId: sessionId,
          createdAt: now,
          updatedAt: now,
        }
        const s: Session = {
          id: sessionId,
          taskId,
          title: finalTitle,
          status: 'draft',
          messageIds: [],
          createdAt: now,
          updatedAt: now,
        }
        set((prev) => ({
          activeSessionId: sessionId,
          tasks: { ...prev.tasks, [taskId]: t },
          sessions: { ...prev.sessions, [sessionId]: s },
        }))
        return sessionId
      },

      renameSession: (sessionId, title) =>
        set((prev) => {
          const session = prev.sessions[sessionId]
          if (!session) return prev
          const task = prev.tasks[session.taskId]
          const now = Date.now()
          return {
            sessions: {
              ...prev.sessions,
              [sessionId]: { ...session, title, updatedAt: now },
            },
            tasks: task
              ? { ...prev.tasks, [task.id]: { ...task, title, updatedAt: now } }
              : prev.tasks,
          }
        }),

      setSessionExpert: (sessionId, expertId) =>
        set((prev) => {
          const session = prev.sessions[sessionId]
          if (!session) return prev
          const task = prev.tasks[session.taskId]
          if (!task) return prev
          return {
            tasks: {
              ...prev.tasks,
              [task.id]: { ...task, selectedExpertId: expertId, updatedAt: Date.now() },
            },
          }
        }),

      toggleSessionSkill: (sessionId, skillId) =>
        set((prev) => {
          const session = prev.sessions[sessionId]
          if (!session) return prev
          const task = prev.tasks[session.taskId]
          if (!task) return prev
          const exists = task.selectedSkillIds.includes(skillId)
          return {
            tasks: {
              ...prev.tasks,
              [task.id]: {
                ...task,
                selectedSkillIds: exists
                  ? task.selectedSkillIds.filter((id) => id !== skillId)
                  : [...task.selectedSkillIds, skillId],
                updatedAt: Date.now(),
              },
            },
          }
        }),

      commitSession: (sessionId) =>
        set((prev) => {
          const s = prev.sessions[sessionId]
          if (!s) return prev
          if (s.status === 'active') return prev
          const now = Date.now()
          const task = prev.tasks[s.taskId]
          return {
            sessions: {
              ...prev.sessions,
              [sessionId]: { ...s, status: 'active', updatedAt: now },
            },
            tasks: task ? { ...prev.tasks, [task.id]: { ...task, updatedAt: now } } : prev.tasks,
          }
        }),

      deleteSession: (sessionId) =>
        set((prev) => {
          const s = prev.sessions[sessionId]
          if (!s) return prev

          const nextSessions = { ...prev.sessions }
          delete nextSessions[sessionId]

          const nextTasks = { ...prev.tasks }
          delete nextTasks[s.taskId]

          const nextMessages = { ...prev.messages }
          const nextRuns = { ...prev.runs }
          for (const mid of s.messageIds) {
            const m = prev.messages[mid] as any
            if (m?.kind === 'run' && m?.runId) delete nextRuns[m.runId]
            delete nextMessages[mid]
          }

          const activeSessionId =
            prev.activeSessionId === sessionId ? undefined : prev.activeSessionId

          return {
            activeSessionId,
            sessions: nextSessions,
            tasks: nextTasks,
            messages: nextMessages,
            runs: nextRuns,
          }
        }),

      refreshSkills: async () => {
        try {
          const resp = await hermesFetch('/api/skills')
          if (!resp.ok) return
          const data = (await resp.json()) as Array<{ name: string; description?: string; enabled: boolean }>
          set({
            skills: data.map((s) => ({
              id: s.name,
              name: s.name,
              description: s.description ?? '',
              enabled: !!s.enabled,
            })),
          })
        } catch {
          return
        }
      },

      refreshExperts: async () => {
        try {
          const resp = await hermesFetch('/api/experts')
          if (!resp.ok) return
          const data = (await resp.json()) as { experts: ExpertItem[]; categories: ExpertCategoryInfo[] }
          set({ experts: data.experts, expertCategories: data.categories })
        } catch {
          return
        }
      },

      fetchSessions: async () => {
        try {
          const resp = await hermesFetch('/api/sessions')
          if (!resp.ok) return
          const data = await resp.json()
          
          set((prev) => {
            const nextSessions = { ...prev.sessions }
            const nextTasks = { ...prev.tasks }
            
            for (const s of data.sessions) {
              const sid = s.session_id || s.id || `session_${Math.random()}`
              const tid = `t_${sid}`
              const now = s.last_active ? s.last_active * 1000 : Date.now()
              const title = s.title || '新会话'
              
              nextTasks[tid] = {
                id: tid,
                title: title,
                selectedSkillIds: [],
                activeSessionId: sid,
                createdAt: s.started_at ? s.started_at * 1000 : now,
                updatedAt: now,
              }
              
              nextSessions[sid] = {
                id: sid,
                taskId: tid,
                title: title,
                status: s.is_active ? 'active' : 'archived',
                messageIds: prev.sessions[sid]?.messageIds || [],
                createdAt: s.started_at ? s.started_at * 1000 : now,
                updatedAt: now,
              }
            }
            return { sessions: nextSessions, tasks: nextTasks }
          })
        } catch (e) {
          console.error('Failed to fetch sessions', e)
        }
      },

      fetchSessionMessages: async (sessionId: string) => {
        try {
          const resp = await hermesFetch(`/api/sessions/${encodeURIComponent(sessionId)}/messages`)
          if (!resp.ok) return
          const data = await resp.json()
          
          set((prev) => {
            const s = prev.sessions[sessionId]
            if (!s) return prev
            
            const nextMessages = { ...prev.messages }
            const newIds: string[] = []
            
            for (const m of data.messages) {
              const mid = m.id || m.message_id || _id('m')
              nextMessages[mid] = {
                id: mid,
                sessionId,
                kind: m.role === 'user' ? 'user' : 'assistant',
                text: m.content || '',
                createdAt: m.timestamp ? m.timestamp * 1000 : Date.now()
              }
              newIds.push(mid)
            }
            
            return {
              messages: nextMessages,
              sessions: {
                ...prev.sessions,
                [sessionId]: { ...s, messageIds: newIds }
              }
            }
          })
        } catch (e) {
          console.error('Failed to fetch session messages', e)
        }
      },

      addMessage: (sessionId, msg) => {
        const id = _id('m')
        const createdAt = Date.now()
        const message: ChatMessage = { ...(msg as any), id, createdAt, sessionId }
        set((prev) => {
          const s = prev.sessions[sessionId]
          if (!s) return prev
          const nextMessages = { ...prev.messages, [id]: message }

          const nextSessions = {
            ...prev.sessions,
            [sessionId]: {
              ...s,
              messageIds: [...s.messageIds, id],
              updatedAt: createdAt,
            },
          }

          const isFirstUserMsg = (msg as any).kind === 'user' && s.messageIds.length === 0
          const nextTasks = { ...prev.tasks }
          if (isFirstUserMsg) {
            const newTitle = _titleFromFirstUserText((msg as any).text ?? '')
            if (newTitle) {
              nextSessions[sessionId] = { ...nextSessions[sessionId], title: newTitle }
              const t = prev.tasks[s.taskId]
              if (t) nextTasks[t.id] = { ...t, title: newTitle, updatedAt: createdAt }
            }
          }

          return { messages: nextMessages, sessions: nextSessions, tasks: nextTasks }
        })
        if ((msg as any).kind === 'assistant') get().commitSession(sessionId)
        return id
      },

      attachRun: (sessionId, run) => {
        get().updateRun(run.runId, run)
        get().addMessage(sessionId, { kind: 'run', runId: run.runId } as any)
      },

      updateRun: (runId, patch) =>
        set((prev) => ({
          runs: { ...prev.runs, [runId]: { ...(prev.runs[runId] ?? ({} as any)), ...patch } },
        })),

      upsertRunStep: (runId, step) =>
        set((prev) => {
          const r = prev.runs[runId]
          if (!r) return prev
          const steps = r.steps ?? []
          const idx = steps.findIndex((s) => s.id === step.id)
          const nextSteps =
            idx === -1
              ? [...steps, { ...step, logs: [] }]
              : steps.map((s, i) => (i === idx ? { ...s, ...step } : s))
          return { runs: { ...prev.runs, [runId]: { ...r, steps: nextSteps } } }
        }),

      appendRunLog: (runId, stepId, log) =>
        set((prev) => {
          const r = prev.runs[runId]
          if (!r) return prev
          const steps = r.steps.map((s) =>
            s.id === stepId ? { ...s, logs: [...(s.logs ?? []), log] } : s,
          )
          return { runs: { ...prev.runs, [runId]: { ...r, steps } } }
        }),

      addRunArtifact: (runId, artifact) =>
        set((prev) => {
          const r = prev.runs[runId]
          if (!r) return prev
          return {
            runs: {
              ...prev.runs,
              [runId]: { ...r, artifacts: [...(r.artifacts ?? []), artifact] },
            },
          }
        }),

      setRunApproval: (runId, approval) =>
        set((prev) => {
          const r = prev.runs[runId]
          if (!r) return prev
          return { runs: { ...prev.runs, [runId]: { ...r, approval } } }
        }),

      toggleSkillEnabled: async (skillId) => {
        try {
          const skill = get().skills.find((s) => s.id === skillId)
          if (!skill) return
          const enabled = !skill.enabled
          const resp = await hermesFetch('/api/skills/toggle', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: skill.name, enabled }),
          })
          if (!resp.ok) return
          set((prev) => ({
            skills: prev.skills.map((s) => (s.id === skillId ? { ...s, enabled } : s)),
          }))
        } catch {
          return
        }
      },

      refreshMcpServers: async () => {
        try {
          const resp = await hermesFetch('/api/mcp')
          if (!resp.ok) return
          const data = await resp.json()
          set({ mcpServers: data.servers || {}, mcpConfigPath: data.config_path || '' })
          
          // Fetch tools for enabled servers in the background
          const servers = data.servers || {}
          for (const [name, config] of Object.entries(servers)) {
            if ((config as any).enabled !== false) {
              get().fetchMcpTools(name)
            }
          }
        } catch (e) {
          console.error('Failed to fetch mcp servers', e)
        }
      },
      
      fetchMcpTools: async (name: string) => {
        set(s => ({ mcpServerTools: { ...s.mcpServerTools, [name]: { loading: true, tools: [] } } }))
        try {
          const resp = await hermesFetch(`/api/mcp/${encodeURIComponent(name)}/tools`)
          if (!resp.ok) {
            const err = await resp.json()
            throw new Error(err.detail || '获取工具失败')
          }
          const data = await resp.json()
          set(s => ({ mcpServerTools: { ...s.mcpServerTools, [name]: { loading: false, tools: data.tools || [] } } }))
        } catch(e: any) {
          set(s => ({ mcpServerTools: { ...s.mcpServerTools, [name]: { loading: false, tools: [], error: e.message } } }))
        }
      },
      
      toggleMcpServer: async (name: string, enabled: boolean) => {
        set(s => ({ mcpServerTools: { ...s.mcpServerTools, [name]: { loading: true, tools: [] } } }))
        
        try {
          const resp = await hermesFetch('/api/mcp/toggle', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, enabled }),
          })
          if (!resp.ok) {
             const err = await resp.json()
             throw new Error(err.detail || '切换失败')
          }
          const data = await resp.json()
          
          set((state) => ({
            mcpServers: {
              ...state.mcpServers,
              [name]: { ...state.mcpServers[name], enabled }
            },
            mcpServerTools: {
              ...state.mcpServerTools,
              [name]: { loading: false, tools: data.tools || [] }
            }
          }))
        } catch (e: any) {
          console.error('Failed to toggle mcp server', e)
          set(s => ({ mcpServerTools: { ...s.mcpServerTools, [name]: { loading: false, tools: [], error: e.message } } }))
          throw e // let UI catch it
        }
      },
      
      deleteMcpServer: async (name: string) => {
        const original = { ...get().mcpServers }
        const next = { ...original }
        delete next[name]
        
        set({ mcpServers: next })
        
        try {
          const resp = await hermesFetch(`/api/mcp/${encodeURIComponent(name)}`, {
            method: 'DELETE',
          })
          if (!resp.ok) throw new Error('Delete failed')
        } catch (e) {
          console.error('Failed to delete mcp server', e)
          set({ mcpServers: original })
        }
      },
      
      saveMcpRaw: async (jsonText: string) => {
        try {
          const resp = await hermesFetch('/api/mcp/raw', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ json_text: jsonText }),
          })
          if (!resp.ok) {
             const err = await resp.json()
             throw new Error(err.detail || '保存失败')
          }
          await get().refreshMcpServers()
        } catch (e) {
          console.error('Failed to save raw mcp config', e)
          throw e
        }
      },

      refreshModels: async () => {
        try {
          const res = await hermesFetch('/api/settings/models')
          if (res.ok) {
            const data = await res.json()
            set({ activeProvider: data.activeProvider || '', activeModel: data.activeModel || '', modelProviders: data.providers || [] })
          }
        } catch (e) {
          console.error('Failed to fetch models', e)
        }
      },

      updateProvider: async (data: any) => {
        try {
          const res = await hermesFetch('/api/settings/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Update failed')
          await get().refreshModels()
        } catch (e) {
          console.error('Failed to update provider', e)
          throw e
        }
      },

      deleteProvider: async (id: string) => {
        try {
          const res = await hermesFetch(`/api/settings/providers/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error('Delete failed')
          await get().refreshModels()
        } catch (e) {
          console.error('Failed to delete provider', e)
          throw e
        }
      },

      setActiveModel: async (provider: string, model: string) => {
        try {
          const res = await hermesFetch('/api/settings/active_model', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider, model }),
          })
          if (!res.ok) throw new Error('Update failed')
          set({ activeProvider: provider, activeModel: model })
        } catch (e) {
          console.error('Failed to set active model', e)
          throw e
        }
      }
    }),
    {
      name: 'typeclaw_store_v3',
      partialize: (s) => ({
        activeSessionId: s.activeSessionId,
        tasks: s.tasks,
        sessions: s.sessions,
        messages: s.messages,
        runs: s.runs,
        skills: s.skills,
      }),
    },
  ),
)
