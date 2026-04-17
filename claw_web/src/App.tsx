import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { AutomationPage } from './pages/AutomationPage'
import { ExpertsPage } from './pages/ExpertsPage'
import { SkillsPage } from './pages/SkillsPage'
import { SkillDetailPage } from './pages/SkillDetailPage'
import { SessionPage } from './pages/SessionPage'
import { SessionRedirect } from './pages/SessionRedirect'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SessionRedirect />} />
        <Route path="sessions/:sessionId" element={<SessionPage />} />
        <Route path="experts" element={<ExpertsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="skills/*" element={<SkillDetailPage />} />
        <Route path="automation" element={<AutomationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
