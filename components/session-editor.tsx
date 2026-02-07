'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StaffMember, Role, Session } from '@/lib/types'
import { timeToMinutes } from '@/lib/types'

interface SessionEditorProps {
  sessions: Session[]
  staff: StaffMember[]
  roles: Role[]
  onAddSession: (title: string, startTime: string, endTime: string) => void
  onUpdateSession: (id: string, updates: Partial<Session>) => void
  onRemoveSession: (id: string) => void
  getAssignment: (sessionId: string, staffId: string) => string
  setAssignment: (sessionId: string, staffId: string, roleId: string) => void
}

export function SessionEditor({
  sessions,
  staff,
  roles,
  onAddSession,
  onUpdateSession,
  onRemoveSession,
  getAssignment,
  setAssignment,
}: SessionEditorProps) {
  const [newTitle, setNewTitle] = useState('')
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('10:00')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const sortedSessions = [...sessions].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  const handleAdd = () => {
    if (newTitle.trim()) {
      onAddSession(newTitle.trim(), newStart, newEnd)
      setNewTitle('')
    }
  }

  const handleStartEdit = (s: Session) => {
    setEditingId(s.id)
    setEditTitle(s.title)
    setEditStart(s.startTime)
    setEditEnd(s.endTime)
  }

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      onUpdateSession(editingId, {
        title: editTitle.trim(),
        startTime: editStart,
        endTime: editEnd,
      })
    }
    setEditingId(null)
  }

  const toggleExpand = (id: string) => {
    setExpandedSession(expandedSession === id ? null : id)
  }

  const getRoleById = (roleId: string) => roles.find(r => r.id === roleId)

  return (
    <div className="flex flex-col gap-6">
      {/* Add Session Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新しいセッションを追加</CardTitle>
          <CardDescription>セッションのタイトルと時間帯を設定します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label htmlFor="session-title" className="text-sm font-medium text-muted-foreground">タイトル</label>
              <Input
                id="session-title"
                placeholder="セッション名..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="session-start" className="text-sm font-medium text-muted-foreground">開始</label>
              <Input
                id="session-start"
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="session-end" className="text-sm font-medium text-muted-foreground">終了</label>
              <Input
                id="session-end"
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-32"
              />
            </div>
            <Button onClick={handleAdd} disabled={!newTitle.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session List with Assignments */}
      {sortedSessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            セッションが登録されていません。上のフォームからセッションを追加してください。
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedSessions.map((session) => {
            const isEditing = editingId === session.id
            const isExpanded = expandedSession === session.id
            const durationMin = timeToMinutes(session.endTime) - timeToMinutes(session.startTime)

            return (
              <Card key={session.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="h-8 flex-1 min-w-[150px]"
                        autoFocus
                      />
                      <Input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        className="h-8 w-28"
                      />
                      <span className="text-muted-foreground text-sm">~</span>
                      <Input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                        className="h-8 w-28"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                        onClick={() => toggleExpand(session.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-sm">{session.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {session.startTime + ' ~ ' + session.endTime}
                          </span>
                          <span className="text-xs">
                            {'(' + durationMin + '分)'}
                          </span>
                        </div>
                        {/* Assignment summary badges */}
                        <div className="flex items-center gap-1 ml-2">
                          {staff.map(s => {
                            const roleId = getAssignment(session.id, s.id)
                            const role = getRoleById(roleId)
                            if (!role) return null
                            return (
                              <span
                                key={s.id}
                                className="inline-block w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: role.color }}
                                title={s.name + ': ' + role.name}
                              />
                            )
                          })}
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(session)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onRemoveSession(session.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Assignment grid - expandable */}
                {isExpanded && staff.length > 0 && (
                  <CardContent className="p-4">
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))` }}>
                      {staff.map((s) => {
                        const currentRoleId = getAssignment(session.id, s.id)
                        const currentRole = getRoleById(currentRoleId)

                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 rounded-md border px-3 py-2"
                            style={currentRole ? {
                              backgroundColor: currentRole.color + '18',
                              borderColor: currentRole.color + '40',
                            } : {}}
                          >
                            <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
                            <Select
                              value={currentRoleId || '_none'}
                              onValueChange={(val) => setAssignment(session.id, s.id, val === '_none' ? '' : val)}
                            >
                              <SelectTrigger className="w-28 h-7 text-xs">
                                <SelectValue placeholder="未割当" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">
                                  <span className="text-muted-foreground">未割当</span>
                                </SelectItem>
                                {roles.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: r.color }}
                                      />
                                      <span>{r.name}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })}
                    </div>
                    {staff.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        スタッフを設定画面で追加してください
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
