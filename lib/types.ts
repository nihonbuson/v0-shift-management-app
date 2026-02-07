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

export interface Session {
  id: string
  title: string
  startTime: string // "HH:MM" format
  endTime: string // "HH:MM" format
}

export interface Assignment {
  sessionId: string
  staffId: string
  roleId: string // empty string means unassigned
}

export interface ShiftData {
  staff: StaffMember[]
  roles: Role[]
  sessions: Session[]
  assignments: Assignment[]
  gridStartTime: string // "HH:MM"
  gridEndTime: string // "HH:MM"
}

export const DEFAULT_ROLES: Role[] = [
  { id: 'role-1', name: '発表', color: '#ef4444', textColor: '#ffffff' },
  { id: 'role-2', name: 'サポート', color: '#3b82f6', textColor: '#ffffff' },
  { id: 'role-3', name: '撮影', color: '#22c55e', textColor: '#ffffff' },
  { id: 'role-4', name: '事務局対応', color: '#eab308', textColor: '#1a1a1a' },
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
    { id: 'session-1', title: '開会式', startTime: '09:00', endTime: '09:30' },
    { id: 'session-2', title: 'セッションA', startTime: '09:30', endTime: '10:30' },
    { id: 'session-3', title: '休憩', startTime: '10:30', endTime: '10:45' },
    { id: 'session-4', title: 'セッションB', startTime: '10:45', endTime: '12:00' },
  ],
  assignments: [],
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

export function generateTimeSlots(startTime: string, endTime: string, intervalMinutes: number = 5): string[] {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const slots: string[] = []
  for (let t = start; t < end; t += intervalMinutes) {
    slots.push(minutesToTime(t))
  }
  return slots
}
