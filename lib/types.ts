export interface StaffMember {
  id: string
  name: string
}

export interface Role {
  id: string
  name: string
  color: string // hex color for background
  textColor: string // hex color for text
}

export interface Override {
  id: string
  startTime: string // "HH:MM" - must be within the parent session's time range
  endTime: string // "HH:MM" - must be within the parent session's time range
  roleId: string // role to apply during this override period
  note?: string // optional task detail / memo
}

export interface Assignment {
  sessionId: string
  staffId: string
  roleId: string // default role for the entire session
  note?: string // optional task detail / memo for the default assignment
  overrides: Override[]
}

export interface Milestone {
  id: string
  offsetMinutes: number // minutes after session start
  label: string // e.g. "ワークシートA配布"
}

export interface Session {
  id: string
  dayId: number // 1 or 2
  title: string
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  milestones: Milestone[]
}

export interface DayConfig {
  id: number // 1 or 2
  label: string // "Day 1", "Day 2", or custom
  date?: string // optional date string for display
}

export interface ShiftData {
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  days: DayConfig[]
  gridStartTime: string // "HH:MM"
  gridEndTime: string // "HH:MM"
}

export const DEFAULT_ROLES: Role[] = [
  { id: 'role-1', name: '発表', color: '#ef4444', textColor: '#ffffff' },
  { id: 'role-2', name: 'サポート', color: '#3b82f6', textColor: '#ffffff' },
  { id: 'role-3', name: '撮影', color: '#22c55e', textColor: '#ffffff' },
  { id: 'role-4', name: '事務局対応', color: '#eab308', textColor: '#1a1a1a' },
  { id: 'role-5', name: '昼食', color: '#f97316', textColor: '#ffffff' },
  { id: 'role-6', name: '休憩', color: '#a855f7', textColor: '#ffffff' },
]

export const DEFAULT_DAYS: DayConfig[] = [
  { id: 1, label: 'Day 1' },
  { id: 2, label: 'Day 2' },
]

export const DEFAULT_SHIFT_DATA: ShiftData = {
  staff: [
    { id: 'staff-1', name: '田中' },
    { id: 'staff-2', name: '鈴木' },
    { id: 'staff-3', name: '佐藤' },
    { id: 'staff-4', name: '高橋' },
  ],
  roles: DEFAULT_ROLES,
  sessions: [
    { id: 'session-1', dayId: 1, title: '開会式', startTime: '09:00', endTime: '09:30', milestones: [] },
    { id: 'session-2', dayId: 1, title: 'セッションA', startTime: '09:30', endTime: '10:30', milestones: [] },
    { id: 'session-3', dayId: 1, title: '休憩', startTime: '10:30', endTime: '10:45', milestones: [] },
    { id: 'session-4', dayId: 1, title: 'セッションB', startTime: '10:45', endTime: '12:00', milestones: [] },
    { id: 'session-5', dayId: 2, title: '振り返り', startTime: '09:00', endTime: '10:00', milestones: [] },
    { id: 'session-6', dayId: 2, title: 'ワークショップC', startTime: '10:00', endTime: '12:00', milestones: [] },
  ],
  assignments: [],
  days: DEFAULT_DAYS,
  gridStartTime: '08:00',
  gridEndTime: '18:00',
}

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  intervalMinutes: number = 5
): string[] {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const slots: string[] = []
  for (let t = start; t < end; t += intervalMinutes) {
    slots.push(minutesToTime(t))
  }
  return slots
}
