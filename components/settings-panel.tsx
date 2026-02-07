'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { StaffMember, Role } from '@/lib/types'

interface SettingsPanelProps {
  staff: StaffMember[]
  roles: Role[]
  gridStartTime: string
  gridEndTime: string
  onAddStaff: (name: string) => void
  onUpdateStaff: (id: string, name: string) => void
  onRemoveStaff: (id: string) => void
  onAddRole: (name: string, color: string, textColor: string) => void
  onUpdateRole: (id: string, updates: Partial<Role>) => void
  onRemoveRole: (id: string) => void
  onSetGridTimes: (start: string, end: string) => void
}

export function SettingsPanel({
  staff,
  roles,
  gridStartTime,
  gridEndTime,
  onAddStaff,
  onUpdateStaff,
  onRemoveStaff,
  onAddRole,
  onUpdateRole,
  onRemoveRole,
  onSetGridTimes,
}: SettingsPanelProps) {
  const [newStaffName, setNewStaffName] = useState('')
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
  const [editingStaffName, setEditingStaffName] = useState('')

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColor, setNewRoleColor] = useState('#3b82f6')
  const [newRoleTextColor, setNewRoleTextColor] = useState('#ffffff')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingRoleName, setEditingRoleName] = useState('')
  const [editingRoleColor, setEditingRoleColor] = useState('')
  const [editingRoleTextColor, setEditingRoleTextColor] = useState('')

  const handleAddStaff = () => {
    if (newStaffName.trim()) {
      onAddStaff(newStaffName.trim())
      setNewStaffName('')
    }
  }

  const handleStartEditStaff = (s: StaffMember) => {
    setEditingStaffId(s.id)
    setEditingStaffName(s.name)
  }

  const handleSaveStaff = () => {
    if (editingStaffId && editingStaffName.trim()) {
      onUpdateStaff(editingStaffId, editingStaffName.trim())
    }
    setEditingStaffId(null)
  }

  const handleAddRole = () => {
    if (newRoleName.trim()) {
      onAddRole(newRoleName.trim(), newRoleColor, newRoleTextColor)
      setNewRoleName('')
      setNewRoleColor('#3b82f6')
      setNewRoleTextColor('#ffffff')
    }
  }

  const handleStartEditRole = (r: Role) => {
    setEditingRoleId(r.id)
    setEditingRoleName(r.name)
    setEditingRoleColor(r.color)
    setEditingRoleTextColor(r.textColor)
  }

  const handleSaveRole = () => {
    if (editingRoleId && editingRoleName.trim()) {
      onUpdateRole(editingRoleId, {
        name: editingRoleName.trim(),
        color: editingRoleColor,
        textColor: editingRoleTextColor,
      })
    }
    setEditingRoleId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Grid Time Range */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">表示時間範囲</CardTitle>
          <CardDescription>シフト表に表示する時間帯を設定します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="grid-start" className="text-sm font-medium text-muted-foreground">
                開始
              </label>
              <Input
                id="grid-start"
                type="time"
                value={gridStartTime}
                onChange={(e) => onSetGridTimes(e.target.value, gridEndTime)}
                className="w-36"
              />
            </div>
            <span className="mt-6 text-muted-foreground">~</span>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="grid-end" className="text-sm font-medium text-muted-foreground">
                終了
              </label>
              <Input
                id="grid-end"
                type="time"
                value={gridEndTime}
                onChange={(e) => onSetGridTimes(gridStartTime, e.target.value)}
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Staff Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">スタッフ管理</CardTitle>
            <CardDescription>
              {'スタッフ ' + staff.length + '名'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="スタッフ名を入力..."
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStaff()}
                className="flex-1"
              />
              <Button onClick={handleAddStaff} size="sm" disabled={!newStaffName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 text-xs">名前</TableHead>
                    <TableHead className="h-9 text-xs w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-8 text-sm">
                        スタッフが登録されていません
                      </TableCell>
                    </TableRow>
                  )}
                  {staff.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="py-2">
                        {editingStaffId === s.id ? (
                          <Input
                            value={editingStaffName}
                            onChange={(e) => setEditingStaffName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveStaff()}
                            className="h-8"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium">{s.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {editingStaffId === s.id ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveStaff}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingStaffId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEditStaff(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemoveStaff(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Role Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">役割管理</CardTitle>
            <CardDescription>
              {'役割 ' + roles.length + '件'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="役割名を入力..."
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                className="flex-1"
              />
              <div className="flex items-center gap-1.5">
                <label htmlFor="new-role-bg" className="sr-only">背景色</label>
                <input
                  id="new-role-bg"
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-input"
                  title="背景色"
                />
                <label htmlFor="new-role-text" className="sr-only">文字色</label>
                <input
                  id="new-role-text"
                  type="color"
                  value={newRoleTextColor}
                  onChange={(e) => setNewRoleTextColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-input"
                  title="文字色"
                />
              </div>
              <Button onClick={handleAddRole} size="sm" disabled={!newRoleName.trim()}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 text-xs">役割名</TableHead>
                    <TableHead className="h-9 text-xs w-20">プレビュー</TableHead>
                    <TableHead className="h-9 text-xs w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8 text-sm">
                        役割が登録されていません
                      </TableCell>
                    </TableRow>
                  )}
                  {roles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="py-2">
                        {editingRoleId === r.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingRoleName}
                              onChange={(e) => setEditingRoleName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRole()}
                              className="h-8 flex-1"
                              autoFocus
                            />
                            <input
                              type="color"
                              value={editingRoleColor}
                              onChange={(e) => setEditingRoleColor(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border border-input"
                              title="背景色"
                            />
                            <input
                              type="color"
                              value={editingRoleTextColor}
                              onChange={(e) => setEditingRoleTextColor(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border border-input"
                              title="文字色"
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium">{r.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: r.color, color: r.textColor }}
                        >
                          {r.name}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {editingRoleId === r.id ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveRole}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoleId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEditRole(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onRemoveRole(r.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
