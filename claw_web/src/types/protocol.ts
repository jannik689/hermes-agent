export type StreamEvent<TPayload = unknown> = {
  id: string
  ts: number
  type: string
  payload: TPayload
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'blocked'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type RunLogItem = { level: string; message: string }

export type RunStep = {
  id: string
  name: string
  status: RunStatus
  output?: { preview?: string }
  logs?: RunLogItem[]
}

export type RunArtifact = {
  id: string
  type: 'file' | 'link' | 'note' | 'structured'
  title: string
  uri: string
}

export type RunApproval = {
  approvalId: string
  scope: string
  reason: string
  proposal?: { path?: string; preview?: string }
  status: 'pending' | 'approved' | 'denied'
}

export type RunState = {
  runId: string
  status: RunStatus
  steps: RunStep[]
  finalText?: string
  artifacts?: RunArtifact[]
  approval?: RunApproval
  streamingText?: string
}

