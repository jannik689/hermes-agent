export type TaskMode = 'plan' | 'chat'

export type TaskStatus = 'active' | 'done' | 'blocked' | 'archived'

export type Task = {
  id: string
  title: string
  selectedSkillIds: string[]
  selectedExpertId?: string
  activeSessionId: string
  createdAt: number
  updatedAt: number
}

export interface Session {
  id: string
  taskId: string
  title: string
  status: 'draft' | 'active' | 'archived'
  messageIds: string[]
  createdAt: number
  updatedAt: number
}

export type ChatMessage =
  | {
      id: string
      sessionId: string
      kind: 'user' | 'assistant'
      text: string
      createdAt: number
    }
  | {
      id: string
      sessionId: string
      kind: 'run'
      runId: string
      createdAt: number
    }

export type ExpertCategory =
  | 'all'
  | 'design'
  | 'engineering'
  | 'marketing'
  | 'paid'
  | 'sales'

export type ExpertItem = {
  id: string
  name: string
  tag: string
  description: string
  category: ExpertCategory
  featured?: boolean
}

export type ExpertCategoryInfo = {
  key: ExpertCategory
  label: string
  count?: number
}

export type AutomationJob = {
  id: string
  name: string
  prompt: string
  schedule: any
  schedule_display: string
  enabled: boolean
  state: string
  next_run_at: string | null
  last_run_at: string | null
  deliver: string
  workspace?: string
}

export type InstalledSkill = {
  id: string
  name: string
  description: string
  enabled: boolean
}
