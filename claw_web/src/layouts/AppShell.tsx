import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SettingsModal } from '../components/SettingsModal'
import { Sidebar } from '../components/Sidebar'
import { useAppStore } from '../store/appStore'

export function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const refreshSkills = useAppStore((s) => s.refreshSkills)

  useEffect(() => {
    refreshSkills()
  }, [refreshSkills])

  return (
    <div className="h-full bg-[radial-gradient(1200px_circle_at_20%_-10%,rgba(255,255,255,0.9)_0,rgba(250,250,250,0.9)_45%,rgba(244,244,245,1)_100%)] p-6">
      <div className="mx-auto flex h-[calc(100dvh-3rem)] max-w-[1360px] overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white shadow-[0_20px_70px_rgba(0,0,0,0.08)]">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <div className="flex min-w-0 flex-1 flex-col bg-zinc-50">
          <Outlet />
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
