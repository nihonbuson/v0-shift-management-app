'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, Clock, CalendarClock, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { StaffMember, Role, DayConfig, StaffOverride } from '@/lib/types'
import { timeToMinutes, minutesToTime } from '@/lib/types'

interface StaffOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffMember[]
  roles: Role[]
  days: DayConfig[]
  staffOverrides: StaffOverride[]
  gridStartTime: string
  gridEndTime: string
  onAdd: (override: Omit<StaffOverride, 'id'>) => void
  onUpdate: (id: string, updates: Partial<Omit<StaffOverride, 'id'>>) => void
  onRemove: (id: string) => void
}

interface EditingState {
  id: string
  staffId: string
  dayId: number
  startTime: string
  endTime: string
  roleId: string
  note: string
}

function generateTimeOptions(start: string, end: string): string[] {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  const options: string[] = []
  for (let m = startMin; m <= endMin; m += 5) {
    options.push(minutesToTime(m))
  }
  return options
}

export function StaffOverrideDialog({
  open,
  onOpenChange,
  staff,
  roles,
  days,
  staffOverrides,
  gridStartTime,
  gridEndTime,
  onAdd,
  onUpdate,
  onRemove,
}: StaffOverrideDialogProps) {
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  // Form state for new override
  const [newStaffId, setNewStaffId] = useState('')
  const [newDayId, setNewDayId] = useState<number>(days[0]?.id ?? 1)
  const [newStartTime, setNewStartTime] = useState(gridStartTime)
  const [newEndTime, setNewEndTime] = useState(
    minutesToTime(timeToMinutes(gridStartTime) + 60)
  )
  const [newRoleId, setNewRoleId] = useState('')
  const [newNote, setNewNote] = useState('')

  const timeOptions = useMemo(
    () => generateTimeOptions(gridStartTime, gridEndTime),
    [gridStartTime, gridEndTime]
  )

  const roleMap = useMemo(() => {
    const map = new Map<string, Role>()
    for (const r of roles) map.set(r.id, r)
    return map
  }, [roles])

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffMember>()
    for (const s of staff) map.set(s.id, s)
    return map
  }, [staff])

  const dayMap = useMemo(() => {
    const map = new Map<number, DayConfig>()
    for (const d of days) map.set(d.id, d)
    return map
  }, [days])

  // Group overrides by day
  const overridesByDay = useMemo(() => {
    const grouped = new Map<number, StaffOverride[]>()
    for (const day of days) {
      grouped.set(day.id, [])
    }
    for (const so of staffOverrides) {
      const arr = grouped.get(so.dayId) || []
      arr.push(so)
      grouped.set(so.dayId, arr)
    }
    // Sort by startTime within each group
    for (const [, arr] of grouped) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return grouped
  }, [staffOverrides, days])

  const handleAdd = () => {
    if (!newStaffId || !newRoleId) return
    if (timeToMinutes(newStartTime) >= timeToMinutes(newEndTime)) return

    onAdd({
      staffId: newStaffId,
      dayId: newDayId,
      startTime: newStartTime,
      endTime: newEndTime,
      roleId: newRoleId,
      note: newNote,
    })

    // Reset form
    setNewNote('')
    setIsAdding(false)
  }

  const handleStartEdit = (so: StaffOverride) => {
    setEditing({
      id: so.id,
      staffId: so.staffId,
      dayId: so.dayId,
      startTime: so.startTime,
      endTime: so.endTime,
      roleId: so.roleId,
      note: so.note,
    })
  }

  const handleSaveEdit = () => {
    if (!editing) return
    if (timeToMinutes(editing.startTime) >= timeToMinutes(editing.endTime)) return

    onUpdate(editing.id, {
      staffId: editing.staffId,
      dayId: editing.dayId,
      startTime: editing.startTime,
      endTime: editing.endTime,
      roleId: editing.roleId,
      note: editing.note,
    })
    setEditing(null)
  }

  const handleCancelEdit = () => {
    setEditing(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            個別予定管理
          </DialogTitle>
          <DialogDescription>
            特定のスタッフに対して、セッションに関係なく時間帯ごとの役割を設定できます。シフト表でセッションの割り当てより優先して表示されます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 mt-2">
          {/* Existing overrides by day */}
          {days.map((day) => {
            const dayOverrides = overridesByDay.get(day.id) || []
            return (
              <div key={day.id} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {day.label}
                  {day.date ? ` (${day.date})` : ''}
                </h3>

                {dayOverrides.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    個別予定はまだ登録されていません。
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">スタッフ</TableHead>
                          <TableHead className="w-[100px]">開始</TableHead>
                          <TableHead className="w-[100px]">終了</TableHead>
                          <TableHead className="w-[120px]">役割</TableHead>
                          <TableHead>メモ</TableHead>
                          <TableHead className="w-[80px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dayOverrides.map((so) => {
                          const isEditing = editing?.id === so.id
                          const staffName = staffMap.get(so.staffId)?.name ?? '?'
                          const role = roleMap.get(so.roleId)

                          if (isEditing && editing) {
                            return (
                              <TableRow key={so.id}>
                                <TableCell>
                                  <Select
                                    value={editing.staffId}
                                    onValueChange={(v) =>
                                      setEditing({ ...editing, staffId: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {staff.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                          {s.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={editing.startTime}
                                    onValueChange={(v) =>
                                      setEditing({ ...editing, startTime: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs font-mono">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map((t) => (
                                        <SelectItem key={t} value={t}>
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={editing.endTime}
                                    onValueChange={(v) =>
                                      setEditing({ ...editing, endTime: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs font-mono">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {timeOptions.map((t) => (
                                        <SelectItem key={t} value={t}>
                                          {t}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={editing.roleId}
                                    onValueChange={(v) =>
                                      setEditing({ ...editing, roleId: v })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roles.map((r) => (
                                        <SelectItem key={r.id} value={r.id}>
                                          <span className="flex items-center gap-1.5">
                                            <span
                                              className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                                              style={{ backgroundColor: r.color }}
                                            />
                                            {r.name}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="h-8 text-xs"
                                    value={editing.note}
                                    onChange={(e) =>
                                      setEditing({
                                        ...editing,
                                        note: e.target.value,
                                      })
                                    }
                                    placeholder="メモ（任意）"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={handleSaveEdit}
                                    >
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          }

                          return (
                            <TableRow key={so.id}>
                              <TableCell className="text-xs font-medium">
                                {staffName}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {so.startTime}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {so.endTime}
                              </TableCell>
                              <TableCell>
                                {role ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                                    style={{
                                      backgroundColor: role.color,
                                      color: role.textColor,
                                    }}
                                  >
                                    {role.name}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">?</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {so.note || '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleStartEdit(so)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => onRemove(so.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add new override form */}
          {isAdding ? (
            <div className="rounded-lg border p-4 flex flex-col gap-3 bg-muted/30">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                新しい個別予定を追加
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    スタッフ
                  </label>
                  <Select value={newStaffId} onValueChange={setNewStaffId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">日</label>
                  <Select
                    value={String(newDayId)}
                    onValueChange={(v) => setNewDayId(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">役割</label>
                  <Select value={newRoleId} onValueChange={setNewRoleId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                              style={{ backgroundColor: r.color }}
                            />
                            {r.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    開始時刻
                  </label>
                  <Select value={newStartTime} onValueChange={setNewStartTime}>
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    終了時刻
                  </label>
                  <Select value={newEndTime} onValueChange={setNewEndTime}>
                    <SelectTrigger className="h-8 text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    メモ（任意）
                  </label>
                  <Input
                    className="h-8 text-xs"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="例: 受付対応"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={handleAdd} disabled={!newStaffId || !newRoleId}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  追加
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                  className="bg-transparent"
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAdding(true)
                if (staff.length > 0 && !newStaffId) setNewStaffId(staff[0].id)
                if (roles.length > 0 && !newRoleId) setNewRoleId(roles[0].id)
              }}
              className="w-fit bg-transparent"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              個別予定を追加
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
