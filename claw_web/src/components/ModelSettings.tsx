import { useEffect, useState, useMemo } from 'react'
import { Check, Edit2, Plus, Server, Trash2, X, RefreshCw, Zap, Play } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'
import { hermesFetch } from '../lib/hermesApi'

export function ModelSettings() {
  const activeProvider = useAppStore(s => s.activeProvider)
  const activeModel = useAppStore(s => s.activeModel)
  const modelProviders = useAppStore(s => s.modelProviders)
  const refreshModels = useAppStore(s => s.refreshModels)
  const updateProvider = useAppStore(s => s.updateProvider)
  const deleteProvider = useAppStore(s => s.deleteProvider)
  const setActiveModel = useAppStore(s => s.setActiveModel)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({})
  const [isSaving, setIsSaving] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  useEffect(() => {
    refreshModels()
  }, [refreshModels])

  const sortedProviders = useMemo(() => {
    return [...modelProviders].sort((a, b) => {
      // Configured providers first
      if (a.apiKeySet && !b.apiKeySet) return -1
      if (!a.apiKeySet && b.apiKeySet) return 1
      
      // Then active provider (optional, but good)
      if (a.id === activeProvider) return -1
      if (b.id === activeProvider) return 1

      // Then built-in before custom
      if (!a.isCustom && b.isCustom) return -1
      if (a.isCustom && !b.isCustom) return 1
      
      return 0
    })
  }, [modelProviders, activeProvider])

  const activeProviderItem = modelProviders.find(p => p.id === activeProvider)

  const handleEdit = (provider: any) => {
    setEditingId(provider.id)
    setFormData({
      id: provider.id,
      isCustom: provider.isCustom,
      name: provider.name,
      apiKey: provider.apiKeySet ? '********' : '',
      baseUrl: provider.baseUrl || '',
      defaultModel: provider.defaultModel || '',
      transport: provider.transport || 'openai'
    })
  }

  const handleAddNew = () => {
    setEditingId('new')
    setFormData({
      id: '',
      isCustom: true,
      name: '新模型商',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      transport: 'openai'
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateProvider(formData)
      setEditingId(null)
    } catch (e: any) {
      alert(e.message || '保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个自定义模型商吗？')) return
    try {
      await deleteProvider(id)
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  const handleSwitch = async (provider: any) => {
    const modelToUse = provider.defaultModel
    if (!modelToUse) {
      alert('请先点击编辑，配置该模型商的模型名称！')
      handleEdit(provider)
      return
    }

    setSwitchingId(provider.id)
    try {
      const res = await hermesFetch(`/api/settings/providers/${encodeURIComponent(provider.id)}/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: modelToUse }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || err?.message || '连通性测试失败')
      }

      await setActiveModel(provider.id, modelToUse)
    } catch (e: any) {
      alert(`切换失败: ${e.message}`)
    } finally {
      setSwitchingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Active Model Section */}
      <div className="shrink-0 p-5 border-b border-zinc-200/80 bg-white flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            当前默认模型
          </h3>
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-800">
            {activeProviderItem ? (
              <>
                <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-200/60 rounded-md font-medium shadow-sm">
                  {activeProviderItem.name}
                </span>
                <span className="text-zinc-400">/</span>
                <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-200/60 rounded-md font-medium shadow-sm">
                  {activeModel || '未指定'}
                </span>
              </>
            ) : (
              <span className="text-zinc-500">{activeModel || '未配置'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Providers List */}
      <div className="flex-1 overflow-y-auto p-5 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Server className="h-4 w-4 text-zinc-500" />
            模型商配置 ({modelProviders.length})
          </h3>
          <button 
            onClick={handleAddNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            添加自定义
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {sortedProviders.map(p => {
            const isEditing = editingId === p.id
            const isSwitching = switchingId === p.id
            const isActive = activeProvider === p.id
            const configuredModel = p.defaultModel

            if (isEditing) {
              return (
                <div key={p.id} className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-semibold text-zinc-900">{p.isCustom ? (p.id === 'new' ? '新建自定义模型商' : '编辑自定义模型商') : `配置 ${p.name}`}</h4>
                    <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-md">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {p.isCustom && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">显示名称</label>
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">API Key</label>
                      <input 
                        type="password" 
                        value={formData.apiKey} 
                        onChange={e => setFormData({...formData, apiKey: e.target.value})}
                        placeholder={p.apiKeySet ? "已设置 (输入新值覆盖)" : "sk-..."}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                      />
                    </div>
                    {(!p.isCustom && p.urlEnv !== undefined) || p.isCustom ? (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">Base URL (代理地址)</label>
                        <input 
                          type="text" 
                          value={formData.baseUrl} 
                          onChange={e => setFormData({...formData, baseUrl: e.target.value})}
                          placeholder="https://api.openai.com/v1"
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                        />
                      </div>
                    ) : null}
                    
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1.5">默认模型 (选填)</label>
                      <input 
                        type="text" 
                        value={formData.defaultModel} 
                        onChange={e => setFormData({...formData, defaultModel: e.target.value})}
                        placeholder="例如: qwen-max, gpt-4o"
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                      />
                    </div>
                    
                    {p.isCustom && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1.5">协议</label>
                        <select 
                          value={formData.transport}
                          onChange={e => setFormData({...formData, transport: e.target.value})}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                        >
                          <option value="openai">OpenAI 兼容</option>
                          <option value="anthropic">Anthropic</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-zinc-100">
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl">取消</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-50">
                      {isSaving ? '保存中...' : '保存配置'}
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={p.id} className={cn("group flex flex-col bg-white border rounded-2xl p-4 transition-colors shadow-sm", isActive ? "border-zinc-900/30 ring-1 ring-zinc-900/5" : "border-zinc-200/60 hover:border-zinc-300")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 truncate">{p.name}</span>
                        {p.isCustom && <span className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Custom</span>}
                        {p.apiKeySet ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                            <Check className="h-3 w-3" /> 已配置
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded font-medium">
                            未配置
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-1">
                        模型: {configuredModel || '未设置'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1 mr-2">
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md"
                        title="编辑配置"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {p.isCustom && (
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {isActive ? (
                      <span className="px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-lg shadow-sm">
                        当前使用
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleSwitch(p)}
                        disabled={isSwitching || !p.apiKeySet}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-medium rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSwitching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        切换
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          
          {editingId === 'new' && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm mt-3">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-900">新建自定义模型商</h4>
                <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 rounded-md">
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">ID (唯一标识，字母或数字)</label>
                  <input 
                    type="text" 
                    value={formData.id} 
                    onChange={e => setFormData({...formData, id: e.target.value})}
                    placeholder="e.g. my-company-api"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">显示名称</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="我的企业内网 API"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">API Key</label>
                  <input 
                    type="password" 
                    value={formData.apiKey} 
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                    placeholder="sk-..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Base URL (代理地址)</label>
                  <input 
                    type="text" 
                    value={formData.baseUrl} 
                    onChange={e => setFormData({...formData, baseUrl: e.target.value})}
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">默认模型 (选填)</label>
                  <input 
                    type="text" 
                    value={formData.defaultModel} 
                    onChange={e => setFormData({...formData, defaultModel: e.target.value})}
                    placeholder="例如: gpt-4o"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">协议</label>
                  <select 
                    value={formData.transport}
                    onChange={e => setFormData({...formData, transport: e.target.value})}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  >
                    <option value="openai">OpenAI 兼容</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-zinc-100">
                <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl">取消</button>
                <button onClick={handleSave} disabled={isSaving || !formData.id} className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl disabled:opacity-50">
                  {isSaving ? '保存中...' : '保存配置'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
