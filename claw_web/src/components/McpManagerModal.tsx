import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, Search, Server, Settings, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'

export function McpManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open)
  const [active, setActive] = useState(false)
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  
  const mcpServers = useAppStore((s) => s.mcpServers)
  const mcpConfigPath = useAppStore((s) => s.mcpConfigPath)
  const mcpServerTools = useAppStore((s) => s.mcpServerTools)
  const refreshMcpServers = useAppStore((s) => s.refreshMcpServers)
  const toggleMcpServer = useAppStore((s) => s.toggleMcpServer)
  const deleteMcpServer = useAppStore((s) => s.deleteMcpServer)
  const saveMcpRaw = useAppStore((s) => s.saveMcpRaw)

  const [editorText, setEditorText] = useState('')
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (open) {
      setMounted(true)
      setView('list')
      refreshMcpServers()
      requestAnimationFrame(() => setActive(true))
      return
    }
    setActive(false)
    const t = window.setTimeout(() => setMounted(false), 200)
    return () => window.clearTimeout(t)
  }, [open, refreshMcpServers])

  // Generate editor JSON
  useEffect(() => {
    if (view === 'editor') {
      const serversForEditor: Record<string, any> = {}
      for (const [k, v] of Object.entries(mcpServers)) {
        const cloned = { ...v }
        // Map enabled -> disabled for standard mcp.json format
        if (typeof cloned.enabled === 'boolean') {
          cloned.disabled = !cloned.enabled
          delete cloned.enabled
        }
        serversForEditor[k] = cloned
      }
      setEditorText(JSON.stringify({ mcpServers: serversForEditor }, null, 2))
      setSaveError('')
    }
  }, [view, mcpServers])

  if (!mounted) return null

  const serverEntries = Object.entries(mcpServers).map(([name, config]) => ({ name, config }))
  
  const filtered = serverEntries.filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
  const enabledCount = serverEntries.filter(({ config }) => config.enabled !== false).length

  const handleSave = async () => {
    try {
      await saveMcpRaw(editorText)
      setView('list')
    } catch (e: any) {
      setSaveError(e.message || '保存失败')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-label="关闭"
      />
      <div
        className={cn(
          'relative flex flex-col w-[800px] max-w-[calc(100vw-2rem)] h-[680px] max-h-[calc(100dvh-2rem)] bg-white rounded-2xl shadow-2xl transition duration-200 overflow-hidden',
          active ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200/80 shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-900">MCP 服务管理</div>
              <div className="text-sm text-zinc-500 mt-0.5">安装 MCP 服务，为 AI 扩展更多工具能力</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === 'list' && (
              <button
                type="button"
                onClick={() => setView('editor')}
                className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                配置 MCP
              </button>
            )}
            <button
              type="button"
              className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {view === 'list' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="px-6 pt-5 pb-2 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-zinc-900/10 focus-within:border-zinc-300 transition-all">
                <Search className="h-5 w-5 text-zinc-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索服务器..."
                  className="flex-1 bg-transparent text-sm outline-none text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                MCP Hub
              </button>
            </div>

            <div className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-zinc-800">
                我的 MCP
                <span className="bg-zinc-100 text-zinc-600 text-xs px-2 py-0.5 rounded-full font-semibold">{serverEntries.length}</span>
              </div>
              <div className="text-sm text-zinc-500">{enabledCount} 启用</div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">无匹配的服务器</div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(({ name, config }) => {
                    const isExpanded = expanded[name]
                    const isEnabled = config.enabled !== false
                    const initial = name.charAt(0).toUpperCase()
                    // Random-ish color based on name length for visual variety
                    const colors = ['bg-orange-500', 'bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-indigo-500']
                    const bgColor = colors[name.length % colors.length]
                    
                    const toolState = mcpServerTools[name] || { loading: false, tools: [] }
                    // Fallback to config include list if not loaded yet
                    const toolsList = toolState.tools.length > 0 
                      ? toolState.tools 
                      : (Array.isArray(config.tools?.include) ? config.tools.include : null)

                    return (
                      <div key={name} className="group flex flex-col rounded-xl border border-transparent hover:border-zinc-200/60 hover:bg-zinc-50/50 transition-colors overflow-hidden">
                        <div className="flex items-center gap-4 px-2 py-3">
                          <button
                            type="button"
                            className="p-1.5 text-zinc-400 hover:bg-zinc-200/50 rounded-lg"
                            onClick={() => setExpanded(e => ({ ...e, [name]: !isExpanded }))}
                          >
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                          </button>
                          
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white font-bold text-lg", bgColor)}>
                            {initial}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-900 truncate">{name}</span>
                              <span className={cn("h-2 w-2 rounded-full shrink-0", isEnabled ? "bg-emerald-500" : "bg-zinc-400")} />
                            </div>
                            <div className="text-sm text-zinc-500 truncate mt-0.5">
                              {toolState.loading ? '正在获取工具列表...' : (toolsList ? `${toolsList.length} 个工具` : '工具')}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              type="button" 
                              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 rounded-lg"
                              onClick={() => {
                                if (isEnabled) {
                                  useAppStore.getState().fetchMcpTools(name)
                                }
                              }}
                              disabled={toolState.loading}
                            >
                              <RefreshCw className={cn("h-4 w-4", toolState.loading && "animate-spin")} />
                            </button>
                            <button
                              type="button"
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              onClick={() => {
                                if (confirm(`确定要删除 MCP 服务器 ${name} 吗？`)) {
                                  deleteMcpServer(name)
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            className={cn('ml-2', isEnabled ? 'text-emerald-500' : 'text-zinc-300', toolState.loading && 'opacity-50 cursor-not-allowed')}
                            onClick={() => toggleMcpServer(name, !isEnabled)}
                            disabled={toolState.loading}
                          >
                            {toolState.loading ? <RefreshCw className="h-6 w-6 animate-spin text-zinc-400 mr-1" /> : (isEnabled ? <ToggleRight className="h-8 w-8" /> : <ToggleLeft className="h-8 w-8" />)}
                          </button>
                        </div>

                        {/* Error Message */}
                        {toolState.error && (
                          <div className="pl-20 pr-6 pb-3 text-xs text-red-500 font-medium">
                            {toolState.error}
                          </div>
                        )}

                        {/* Tools Content - Auto show if enabled and we have tools */}
                        {(isExpanded || (isEnabled && toolsList && toolsList.length > 0)) && (
                          <div className="pl-20 pr-6 pb-4">
                            {toolState.loading && toolsList?.length === 0 ? (
                              <div className="text-sm text-zinc-400 flex items-center gap-2">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                连接中...
                              </div>
                            ) : toolsList ? (
                              <div className="flex flex-wrap gap-2">
                                {toolsList.map((t: string) => (
                                  <span key={t} className="bg-zinc-100 text-zinc-600 text-xs px-2.5 py-1 rounded-md">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-zinc-400">未发现工具</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-zinc-50">
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-zinc-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1 font-medium"
              >
                &lt; 返回 MCP 列表
              </button>
              <div className="flex items-center gap-3">
                {saveError && <span className="text-sm text-red-500 truncate max-w-[200px]">{saveError}</span>}
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-full hover:bg-zinc-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-zinc-400 rounded-full hover:bg-zinc-500"
                >
                  保存
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-zinc-200/80 bg-zinc-50/50 shrink-0 flex items-center gap-2">
              <span className="text-sm text-zinc-500">配置文件路径:</span>
              <code className="text-sm text-zinc-700 font-mono select-all bg-white px-2 py-0.5 rounded border border-zinc-200/60">
                {mcpConfigPath || '/Users/tuim/.hermes/config.yaml (mcp_servers)'}
              </code>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="w-full h-full font-mono text-sm bg-white border border-zinc-200/80 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 text-zinc-800"
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
