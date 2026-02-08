'use client'

import { useState } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StaffMember, Role, Session, Assignment, Override, DayConfig, Milestone } from '@/lib/types'
import { timeToMinutes, minutesToTime } from '@/lib/types'

interface SessionEditorProps {
  sessions: Session[]
  staff: StaffMember[]
  roles: Role[]
  days: DayConfig[]
  onAddSession: (dayId: number, title: string, durationMinutes: number) => void
  onUpdateSession: (id: string, updates: Partial<Session>) => void
  onRemoveSession: (id: string) => void
  onReorderSession: (sessionId: string, direction: 'up' | 'down') => void
  onUpdateDay: (dayId: number, updates: Partial<DayConfig>) => void
  getAssignment: (sessionId: string, staffId: string) => Assignment | null
  getAssignmentRoleId: (sessionId: string, staffId: string) => string
  setAssignment: (sessionId: string, staffId: string, roleId: string) => void
  setAssignmentNote: (sessionId: string, staffId: string, note: string) => void
  addOverride: (sessionId: string, staffId: string, override: Omit<Override, 'id'>) => void
  updateOverride: (
    sessionId: string,
    staffId: string,
    overrideId: string,
    updates: Partial<Omit<Override, 'id'>>
  ) => void
  removeOverride: (sessionId: string, staffId: string, overrideId: string) => void
  addMilestone: (sessionId: string, milestone: Omit<Milestone, 'id'>) => void
  updateMilestone: (sessionId: string, milestoneId: string, updates: Partial<Omit<Milestone, 'id'>>) => void
  removeMilestone: (sessionId: string, milestoneId: string) => void
}

/* ─── Override row (offset-based) ─── */
function OverrideRow({
  override,
  session,
  roles,
  onUpdate,
  onRemove,
}: {
  override: Override
  session: Session
  roles: Role[]
  onUpdate: (overrideId: string, updates: Partial<Omit<Override, 'id'>>) => void
  onRemove: (overrideId: string) => void
}) {
  const role = roles.find((r) => r.id === override.roleId)
  const durationMin = session.durationMinutes || 60
  const isOutOfRange =
    override.startOffsetMinutes < 0 ||
    override.endOffsetMinutes > durationMin ||
    override.startOffsetMinutes >= override.endOffsetMinutes

  // Build 5-min offset options
  const offsetOptions: number[] = []
  for (let m = 0; m <= durationMin; m += 5) {
    offsetOptions.push(m)
  }

  const formatAbsoluteTime = (offset: number) => {
    const baseMin = timeToMinutes(session.startTime)
    return minutesToTime(baseMin + offset)
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        isOutOfRange ? 'border-destructive/50 bg-destructive/5' : 'border-border'
      }`}
    >
      {isOutOfRange && (
        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
      )}
      <Select
        value={override.startOffsetMinutes.toString()}
        onValueChange={(val) =>
          onUpdate(override.id, { startOffsetMinutes: Number(val) })
        }
      >
        <SelectTrigger className="h-6 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {offsetOptions.map((offset) => (
            <SelectItem key={offset} value={offset.toString()}>
              {'+' + offset + '分 (' + formatAbsoluteTime(offset) + ')'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">~</span>
      <Select
        value={override.endOffsetMinutes.toString()}
        onValueChange={(val) =>
          onUpdate(override.id, { endOffsetMinutes: Number(val) })
        }
      >
        <SelectTrigger className="h-6 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {offsetOptions.map((offset) => (
            <SelectItem key={offset} value={offset.toString()}>
              {'+' + offset + '分 (' + formatAbsoluteTime(offset) + ')'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={override.roleId}
        onValueChange={(val) => onUpdate(override.id, { roleId: val })}
      >
        <SelectTrigger className="h-6 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span>{r.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {role && (
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
          style={{ backgroundColor: role.color, color: role.textColor }}
        >
          {role.name}
        </span>
      )}
      <Input
        value={override.note ?? ''}
        onChange={(e) => onUpdate(override.id, { note: e.target.value })}
        placeholder="作業内容..."
        className="h-6 w-28 text-xs px-1.5"
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive relative z-10"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(override.id)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

/* ─── Staff assignment card ─── */
function StaffAssignmentCard({
  staffMember,
  session,
  assignment,
  roles,
  onSetRole,
  onSetNote,
  onAddOverride,
  onUpdateOverride,
  onRemoveOverride,
}: {
  staffMember: StaffMember
  session: Session
  assignment: Assignment | null
  roles: Role[]
  onSetRole: (roleId: string) => void
  onSetNote: (note: string) => void
  onAddOverride: (override: Omit<Override, 'id'>) => void
  onUpdateOverride: (
    overrideId: string,
    updates: Partial<Omit<Override, 'id'>>
  ) => void
  onRemoveOverride: (overrideId: string) => void
}) {
  const currentRoleId = assignment?.roleId ?? ''
  const currentRole = roles.find((r) => r.id === currentRoleId)
  const overrides = assignment?.overrides ?? []
  const hasOverrides = overrides.length > 0

  const handleAddOverride = () => {
    const durationMin = session.durationMinutes || 60
    const midOffset = Math.round(durationMin / 2 / 5) * 5
    const lunchRole =
      roles.find((r) => r.name === '昼食') ||
      roles.find((r) => r.name === '休憩') ||
      roles[0]
    onAddOverride({
      startOffsetMinutes: midOffset,
      endOffsetMinutes: durationMin,
      roleId: lunchRole?.id ?? roles[0]?.id ?? '',
    })
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border px-3 py-2"
      style={
        currentRole
          ? {
              backgroundColor: currentRole.color + '12',
              borderColor: currentRole.color + '30',
            }
          : {}
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium flex-1 truncate">
          {staffMember.name}
        </span>
        <Select
          value={currentRoleId || '_none'}
          onValueChange={(val) => onSetRole(val === '_none' ? '' : val)}
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
        {currentRoleId && (
          <>
            <Input
              value={assignment?.note ?? ''}
              onChange={(e) => onSetNote(e.target.value)}
              placeholder="作業内容..."
              className="h-7 w-28 text-xs px-1.5"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-muted-foreground px-1.5"
              onClick={handleAddOverride}
              title="例外時間を追加"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              {'例外'}
            </Button>
          </>
        )}
      </div>

      {hasOverrides && (
        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-dashed border-muted-foreground/30 ml-1">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            {'個別調整（相対オフセット）'}
          </span>
          {overrides.map((ov) => (
            <OverrideRow
              key={ov.id}
              override={ov}
              session={session}
              roles={roles}
              onUpdate={onUpdateOverride}
              onRemove={onRemoveOverride}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Milestones section ─── */
function MilestoneSection({
  session,
  onAdd,
  onUpdate,
  onRemove,
}: {
  session: Session
  onAdd: (milestone: Omit<Milestone, 'id'>) => void
  onUpdate: (milestoneId: string, updates: Partial<Omit<Milestone, 'id'>>) => void
  onRemove: (milestoneId: string) => void
}) {
  const milestones = session.milestones || []
  const durationMin = session.durationMinutes || 60

  const handleAdd = () => {
    onAdd({ offsetMinutes: 0, label: '' })
  }

  // Build 5-min offset options for the dropdown
  const offsetOptions: number[] = []
  for (let m = 0; m <= durationMin; m += 5) {
    offsetOptions.push(m)
  }

  const formatAbsoluteTime = (offset: number) => {
    const baseMin = timeToMinutes(session.startTime)
    return minutesToTime(baseMin + offset)
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3 mt-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {'マイルストーン（配布タイミング）'}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2 bg-transparent"
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          {'追加'}
        </Button>
      </div>

      {milestones.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {'配布物やアクションのタイミングを追加できます。'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 bg-card"
            >
              <Select
                value={ms.offsetMinutes.toString()}
                onValueChange={(val) =>
                  onUpdate(ms.id, { offsetMinutes: Number(val) })
                }
              >
                <SelectTrigger className="h-6 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offsetOptions.map((offset) => (
                    <SelectItem key={offset} value={offset.toString()}>
              {'+' + offset + '分 (' + formatAbsoluteTime(offset) + ')'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={ms.label}
        onChange={(e) => onUpdate(ms.id, { label: e.target.value })}
        placeholder="ワークシートA配布..."
                className="h-6 flex-1 text-xs px-1.5"
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatAbsoluteTime(ms.offsetMinutes)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive relative z-10"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(ms.id)
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Session list for a single day ─── */
function DaySessionList({
  dayId,
  sessions,
  staff,
  roles,
  days,
  onAddSession,
  onUpdateSession,
  onRemoveSession,
  onReorderSession,
  onUpdateDay,
  getAssignment,
  getAssignmentRoleId,
  setAssignment,
  setAssignmentNote,
  addOverride,
  updateOverride,
  removeOverride,
  addMilestone,
  updateMilestone,
  removeMilestone,
}: {
  dayId: number
  days: DayConfig[]
} & Omit<SessionEditorProps, 'days'>) {
  const [newTitle, setNewTitle] = useState('')
  const [newDuration, setNewDuration] = useState('60')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const day = days.find((d) => d.id === dayId)
  const dayStartTime = day?.dayStartTime || '09:00'

  // Sessions in array order (not sorted by time - array order IS the truth)
  const daySessions = sessions.filter((s) => s.dayId === dayId)

  const handleAdd = () => {
    if (newTitle.trim()) {
      const duration = Number.parseInt(newDuration, 10) || 60
      onAddSession(dayId, newTitle.trim(), duration)
      setNewTitle('')
      setNewDuration('60')
    }
  }

  const handleStartEdit = (s: Session) => {
    setEditingId(s.id)
    setEditTitle(s.title)
    setEditDuration(s.durationMinutes.toString())
  }

  const handleSaveEdit = () => {
    if (editingId && editTitle.trim()) {
      const duration = Number.parseInt(editDuration, 10) || 30
      onUpdateSession(editingId, {
        title: editTitle.trim(),
        durationMinutes: duration > 0 ? duration : 5,
      })
    }
    setEditingId(null)
  }

  const toggleExpand = (id: string) => {
    setExpandedSession(expandedSession === id ? null : id)
  }

  const getRoleById = (roleId: string) => roles.find((r) => r.id === roleId)

  return (
    <div className="flex flex-col gap-4">
      {/* Day Start Time */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-foreground">
                {'Day 開始時刻'}
              </label>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {'この日の最初の��ッション開始時刻。後続は自動計算されます。'}
              </p>
              <Input
                type="time"
                value={dayStartTime}
                onChange={(e) =>
                  onUpdateDay(dayId, { dayStartTime: e.target.value })
                }
                className="w-32"
              />
            </div>
            <div className="flex-1" />
            {/* Computed timeline summary */}
            {daySessions.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {daySessions[0].startTime +
                  ' ~ ' +
                  daySessions[daySessions.length - 1].endTime +
                  ' (' +
                  daySessions.length +
                  'セッション)'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Session Form */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">
                {'タイトル'}
              </label>
              <Input
                placeholder={'セッション名 / 休憩...'}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {'所要時間（分）'}
              </label>
              <Input
                type="number"
                min={5}
                step={5}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                className="w-24"
                placeholder="60"
              />
            </div>
            <Button onClick={handleAdd} disabled={!newTitle.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {'追加'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session List */}
      {daySessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {'セッションが登録されていません。'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {daySessions.map((session, idx) => {
            const isEditing = editingId === session.id
            const isExpanded = expandedSession === session.id
            const isFirst = idx === 0
            const isLast = idx === daySessions.length - 1

            const totalOverrides = staff.reduce((count, s) => {
              const a = getAssignment(session.id, s.id)
              return count + (a?.overrides?.length ?? 0)
            }, 0)

            return (
              <Card key={session.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
                  {isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className="h-8 flex-1 min-w-[150px]"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={editDuration}
                          onChange={(e) => setEditDuration(e.target.value)}
                          className="h-8 w-20"
                        />
                        <span className="text-xs text-muted-foreground">{'分'}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleSaveEdit}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Reorder buttons */}
                      <div className="flex flex-col gap-0.5 mr-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            onReorderSession(session.id, 'up')
                          }}
                          disabled={isFirst}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            onReorderSession(session.id, 'down')
                          }}
                          disabled={isLast}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>

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
                          <span className="font-medium text-sm text-foreground">
                            {session.title}
                          </span>
                        </div>
                        {/* Computed times - read only */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground/60 font-mono">
                            {session.startTime + ' ~ ' + session.endTime}
                          </span>
                          <span className="text-foreground font-semibold">
                            {'(' + session.durationMinutes + '分)'}
                          </span>
                        </div>
                        {/* Assignment badges */}
                        <div className="flex items-center gap-1 ml-2">
                          {staff.map((s) => {
                            const roleId = getAssignmentRoleId(session.id, s.id)
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
                        {totalOverrides > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium ml-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {totalOverrides + '件'}
                          </span>
                        )}
                        {(session.milestones?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-medium ml-1">
                            <Clock className="h-2.5 w-2.5" />
                            {session.milestones.length + ' MS'}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(session)}
                        >
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

                {isExpanded && (
                  <CardContent className="p-3 flex flex-col gap-3">
                    {staff.length > 0 && (
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns:
                            'repeat(auto-fill, minmax(260px, 1fr))',
                        }}
                      >
                        {staff.map((s) => {
                          const assignment = getAssignment(session.id, s.id)
                          return (
                            <StaffAssignmentCard
                              key={s.id}
                              staffMember={s}
                              session={session}
                              assignment={assignment}
                              roles={roles}
                              onSetRole={(roleId) =>
                                setAssignment(session.id, s.id, roleId)
                              }
                              onAddOverride={(ov) =>
                                addOverride(session.id, s.id, ov)
                              }
                              onUpdateOverride={(ovId, updates) =>
                                updateOverride(session.id, s.id, ovId, updates)
                              }
                              onRemoveOverride={(ovId) =>
                                removeOverride(session.id, s.id, ovId)
                              }
                              onSetNote={(note) =>
                                setAssignmentNote(session.id, s.id, note)
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                    <MilestoneSection
                      session={session}
                      onAdd={(ms) => addMilestone(session.id, ms)}
                      onUpdate={(msId, updates) => updateMilestone(session.id, msId, updates)}
                      onRemove={(msId) => removeMilestone(session.id, msId)}
                    />
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

/* ─── Main export ─── */
export function SessionEditor(props: SessionEditorProps) {
  const { days } = props
  const defaultDay = days[0]?.id?.toString() ?? '1'

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{'セッション管理'}</CardTitle>
          <CardDescription>
            {'セッションは数珠つなぎで自動計算されます。所要時間の変更や並び替えで、後続の時刻が連動して更新されます。'}
          </CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue={defaultDay}>
        <TabsList className="mb-2">
          {days.map((d) => (
            <TabsTrigger key={d.id} value={d.id.toString()}>
              {d.label}
              {d.date ? ` (${d.date})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
        {days.map((d) => (
          <TabsContent key={d.id} value={d.id.toString()}>
            <DaySessionList dayId={d.id} days={days} {...props} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
