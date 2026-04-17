import { File as FileIcon, Loader2, Paperclip, Send, Sparkles, Square, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { useAppStore } from '../store/appStore'

export interface Attachment {
  id: string
  file: File
}

export function ChatComposer({
  className,
  placeholder = '输入消息…',
  onSend,
  isProcessing = false,
  onCancel,
}: {
  className?: string
  placeholder?: string
  onSend?: (input: { text: string; attachments: File[] }) => void
  isProcessing?: boolean
  onCancel?: () => void
}) {
  const [text, setText] = useState('')
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  
  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [showSkillsMenu, setShowSkillsMenu] = useState(false)
  const skillsButtonRef = useRef<HTMLDivElement>(null)
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const draftPrompt = useAppStore((s) => s.draftPrompt)
  const setDraftPrompt = useAppStore((s) => s.setDraftPrompt)
  const skills = useAppStore((s) => s.skills)

  useEffect(() => {
    if (draftPrompt) {
      setText(draftPrompt)
      setDraftPrompt('') // clear it after pulling
    }
  }, [draftPrompt, setDraftPrompt])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (skillsButtonRef.current && !skillsButtonRef.current.contains(e.target as Node)) {
        setShowSkillsMenu(false)
      }
    }
    if (showSkillsMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSkillsMenu])

  // Filter skills based on slash query
  const filteredSkills = useMemo(() => {
    if (!showSlashMenu) return []
    const q = slashQuery.toLowerCase()
    return skills.filter(s => s.enabled !== false && (s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)))
  }, [skills, slashQuery, showSlashMenu])

  const canSend = useMemo(() => text.trim().length > 0 || attachments.length > 0, [text, attachments])

  const send = useCallback(() => {
    const t = text.trim()
    if (!t && attachments.length === 0) return
    onSend?.({ text: t, attachments: attachments.map(a => a.file) })
    setText('')
    setAttachments([])
    setShowSlashMenu(false)
  }, [onSend, text, attachments])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    
    // Detect slash command at the end of text
    // Matches "/" or "/something" at the start of string or after a space
    const match = val.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
    if (match) {
      setShowSlashMenu(true)
      setSlashQuery(match[1])
      setSelectedIndex(0)
    } else {
      setShowSlashMenu(false)
    }
  }

  const insertSkill = (skillName: string) => {
    // Replace the "/query" part with "/skillName "
    const match = text.match(/(^|\s)\/([a-zA-Z0-9_-]*)$/)
    if (match) {
      const before = text.slice(0, match.index! + (match[1] ? 1 : 0))
      const newText = before + `/${skillName} `
      setText(newText)
      setShowSlashMenu(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredSkills.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filteredSkills.length) % filteredSkills.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertSkill(filteredSkills[selectedIndex].name)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSlashMenu(false)
        return
      }
    }

    if (e.key === 'Enter') {
      if (e.altKey || e.shiftKey) {
        // Allow default behavior (newline) for Option+Enter or Shift+Enter
        return
      }
      if (!e.ctrlKey && !e.metaKey) {
        // Normal Enter: prevent default newline and send
        e.preventDefault()
        send()
      }
    }
  }

  // --- Drag and Drop Handlers ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        file
      }))
      setAttachments(prev => [...prev, ...newFiles])
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="relative">
      {/* Slash Command Menu */}
      {showSlashMenu && filteredSkills.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-64 overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-1 shadow-lg shadow-black/5 z-10">
          <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500">选择技能</div>
          <div className="max-h-60 overflow-y-auto">
            {filteredSkills.map((skill, i) => (
              <button
                key={skill.id}
                type="button"
                onClick={() => insertSkill(skill.name)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors',
                  i === selectedIndex ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-200/50 text-[10px] font-bold text-zinc-600">
                  {skill.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{skill.name}</div>
                  {skill.description && (
                    <div className="truncate text-xs text-zinc-500">{skill.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'w-full rounded-3xl border bg-white shadow-sm transition-all duration-200',
          isDragging ? 'border-zinc-400 bg-zinc-50/50 ring-4 ring-zinc-100' : 'border-zinc-200/80 focus-within:border-zinc-300/80 focus-within:ring-2 focus-within:ring-zinc-900/10',
          className,
        )}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 shadow-sm">
                <Paperclip className="h-6 w-6" />
              </div>
              <span className="text-sm font-medium">松开鼠标添加附件</span>
            </div>
          </div>
        )}

        <div className="px-5 pt-5 pb-2">
          <textarea
            ref={textareaRef}
            placeholder={isProcessing ? '正在处理中...' : placeholder}
            rows={3}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="w-full resize-none bg-transparent text-[15px] leading-6 text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {attachments.map(att => (
              <div key={att.id} className="group relative flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-2 pr-1 py-1 max-w-[200px]">
                <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                <span className="truncate text-xs font-medium text-zinc-700">{att.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="ml-1 p-1 rounded-md text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-zinc-100/50">
          <div className="flex items-center gap-2">
            <div className="relative" ref={skillsButtonRef}>
              <button
                type="button"
                onClick={() => setShowSkillsMenu(!showSkillsMenu)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  showSkillsMenu 
                    ? "bg-zinc-200 text-zinc-900" 
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70"
                )}
              >
                <Sparkles className="h-4 w-4 text-zinc-500" />
                Skills
              </button>

              {showSkillsMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-64 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl z-50">
                  <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500">可用技能</div>
                  {skills.filter(s => s.enabled !== false).length === 0 ? (
                    <div className="px-2 py-3 text-xs text-zinc-400 text-center">暂无可用技能</div>
                  ) : (
                    skills.filter(s => s.enabled !== false).map(s => (
                      <button
                        key={s.name}
                        type="button"
                        className="w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100"
                        onClick={() => {
                          const newText = text + (text.endsWith(' ') || text.length === 0 ? '' : ' ') + `/${s.name} `
                          setText(newText)
                          setShowSkillsMenu(false)
                          textareaRef.current?.focus()
                        }}
                      >
                        <div className="flex items-center justify-center rounded-md bg-zinc-100 p-1">
                          <Sparkles className="h-3 w-3 text-zinc-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-zinc-900">{s.name}</div>
                          {s.description && (
                            <div className="truncate text-[10px] text-zinc-500">{s.description}</div>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {isProcessing && (
              <div className="ml-2 flex items-center gap-2 text-xs font-medium text-zinc-500 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Agent 正在执行...
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 relative overflow-hidden"
              aria-label="附件"
            >
              <Paperclip className="h-4 w-4" />
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const newFiles = Array.from(e.target.files).map(file => ({
                      id: Math.random().toString(36).substring(7),
                      file
                    }))
                    setAttachments(prev => [...prev, ...newFiles])
                  }
                  // Reset input value so same file can be selected again
                  e.target.value = ''
                }}
              />
            </button>
            {isProcessing ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
              >
                <Square className="h-4 w-4 fill-current" />
                取消
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-colors',
                  canSend
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'bg-zinc-200 text-zinc-500',
                )}
              >
                <Send className="h-4 w-4" />
                发送
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100/50 px-5 py-2.5 text-center text-[11px] text-zinc-400">
          内容由 AI 生成，请核实重要信息。
        </div>
      </div>
    </div>
  )
}
