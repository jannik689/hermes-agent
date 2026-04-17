import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'

export function SessionRedirect() {
  const navigate = useNavigate()
  const sessionsById = useAppStore((s) => s.sessions)
  const createSession = useAppStore((s) => s.createSession)

  const latest = useMemo(() => {
    const sessions = Object.values(sessionsById)
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  }, [sessionsById])

  useEffect(() => {
    if (latest) return
    const id = createSession('新会话')
    navigate(`/sessions/${id}`, { replace: true })
  }, [createSession, latest, navigate])

  if (!latest) return null
  return <Navigate to={`/sessions/${latest.id}`} replace />
}
