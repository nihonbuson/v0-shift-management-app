'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ShiftData,
  StaffMember,
  Role,
  Session,
  Assignment,
  Override,
  DayConfig,
  Milestone,
  StaffOverride,
} from './types'
import { DEFAULT_SHIFT_DATA, generateId, timeToMinutes, minutesToTime, recomputeSessionTimes } from './types'

const STORAGE_KEY = 'shift-manager-data-v2'

function migrateData(raw: Record<string, unknown>): ShiftData {
  const data = raw as ShiftData
  // Ensure days array exists (migration from v1)
  if (!data.days || !Array.isArray(data.days)) {
    data.days = [
      { id: 1, label: 'Day 1', dayStartTime: '09:00' },
      { id: 2, label: 'Day 2', dayStartTime: '09:00' },
    ]
  }
  // Ensure all days have dayStartTime
  data.days = data.days.map((d: DayConfig) => ({
    ...d,
    dayStartTime: d.dayStartTime || '09:00',
  }))

  // Build session lookup for override migration
  const sessionMap = new Map<string, Session>()

  // Ensure all sessions have dayId, milestones, and durationMinutes
  if (data.sessions) {
    data.sessions = data.sessions.map((s: Session) => {
      const duration =
        s.durationMinutes ||
        (s.startTime && s.endTime
          ? timeToMinutes(s.endTime) - timeToMinutes(s.startTime)
          : 30)
      const migrated = {
        ...s,
        dayId: s.dayId || 1,
        milestones: s.milestones || [],
        durationMinutes: duration > 0 ? duration : 30,
      }
      sessionMap.set(migrated.id, migrated)
      return migrated
    })
  }

  // Ensure all assignments have overrides and migrate absolute->relative
  if (data.assignments) {
    data.assignments = data.assignments.map((a: Assignment) => {
      const session = sessionMap.get(a.sessionId)
      const sessionStartMin = session ? timeToMinutes(session.startTime) : 0
      const sessionDuration = session?.durationMinutes || 60
      return {
        ...a,
        overrides: (a.overrides || []).map((ov: Override) => {
          // If override already has offset fields, keep them
          if (
            typeof ov.startOffsetMinutes === 'number' &&
            typeof ov.endOffsetMinutes === 'number'
          ) {
            return ov
          }
          // Migrate from absolute startTime/endTime to offsets
          const ovStartMin = ov.startTime ? timeToMinutes(ov.startTime) : 0
          const ovEndMin = ov.endTime ? timeToMinutes(ov.endTime) : sessionDuration
          return {
            ...ov,
            startOffsetMinutes: Math.max(0, ovStartMin - sessionStartMin),
            endOffsetMinutes: Math.min(sessionDuration, ovEndMin - sessionStartMin),
          }
        }),
      }
    })
  }

  // Ensure staffOverrides array exists
  if (!data.staffOverrides || !Array.isArray(data.staffOverrides)) {
    data.staffOverrides = []
  }

  // Recompute session times based on sequential order
  data.sessions = recomputeSessionTimes(data.sessions, data.days)

  return data
}

function loadData(): ShiftData {
  if (typeof window === 'undefined') return DEFAULT_SHIFT_DATA
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return migrateData(JSON.parse(stored))
    }
    // Try old key
    const oldStored = localStorage.getItem('shift-manager-data')
    if (oldStored) {
      const migrated = migrateData(JSON.parse(oldStored))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      return migrated
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHIFT_DATA
}

function saveData(data: ShiftData) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

export function useShiftStore() {
  const [data, setData] = useState<ShiftData>(DEFAULT_SHIFT_DATA)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setData(loadData())
    setIsLoaded(true)
  }, [])

  const updateData = useCallback(
    (updater: (prev: ShiftData) => ShiftData, skipRecompute = false) => {
      setData((prev) => {
        const raw = updater(prev)
        // Recompute sequential session times after every mutation
        const next = skipRecompute
          ? raw
          : { ...raw, sessions: recomputeSessionTimes(raw.sessions, raw.days) }
        saveData(next)
        return next
      })
    },
    []
  )

  // Staff operations
  const addStaff = useCallback(
    (name: string) => {
      updateData((prev) => ({
        ...prev,
        staff: [...prev.staff, { id: generateId(), name }],
      }))
    },
    [updateData]
  )

  const updateStaff = useCallback(
    (id: string, name: string) => {
      updateData((prev) => ({
        ...prev,
        staff: prev.staff.map((s) => (s.id === id ? { ...s, name } : s)),
      }))
    },
    [updateData]
  )

  const removeStaff = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        staff: prev.staff.filter((s) => s.id !== id),
        assignments: prev.assignments.filter((a) => a.staffId !== id),
        staffOverrides: prev.staffOverrides.filter((so) => so.staffId !== id),
      }))
    },
    [updateData]
  )

  // Role operations
  const addRole = useCallback(
    (name: string, color: string, textColor: string) => {
      updateData((prev) => ({
        ...prev,
        roles: [...prev.roles, { id: generateId(), name, color, textColor }],
      }))
    },
    [updateData]
  )

  const updateRole = useCallback(
    (id: string, updates: Partial<Role>) => {
      updateData((prev) => ({
        ...prev,
        roles: prev.roles.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      }))
    },
    [updateData]
  )

  const removeRole = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        roles: prev.roles.filter((r) => r.id !== id),
        assignments: prev.assignments.filter((a) => a.roleId !== id),
      }))
    },
    [updateData]
  )

  // Day operations
  const updateDay = useCallback(
    (dayId: number, updates: Partial<DayConfig>) => {
      updateData((prev) => ({
        ...prev,
        days: prev.days.map((d) =>
          d.id === dayId ? { ...d, ...updates } : d
        ),
      }))
    },
    [updateData]
  )

  // Session operations - duration-based sequential
  const addSession = useCallback(
    (dayId: number, title: string, durationMinutes: number) => {
      updateData((prev) => ({
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            id: generateId(),
            dayId,
            title,
            durationMinutes,
            startTime: '00:00', // will be recomputed
            endTime: '00:00', // will be recomputed
            milestones: [],
          },
        ],
      }))
    },
    [updateData]
  )

  // Reorder session within its day
  const reorderSession = useCallback(
    (sessionId: string, direction: 'up' | 'down') => {
      updateData((prev) => {
        const session = prev.sessions.find((s) => s.id === sessionId)
        if (!session) return prev

        // Get indices of sessions in this day (preserving array order)
        const dayIndices: number[] = []
        prev.sessions.forEach((s, idx) => {
          if (s.dayId === session.dayId) dayIndices.push(idx)
        })

        const posInDay = dayIndices.findIndex(
          (idx) => prev.sessions[idx].id === sessionId
        )
        if (posInDay < 0) return prev

        const swapPos =
          direction === 'up' ? posInDay - 1 : posInDay + 1
        if (swapPos < 0 || swapPos >= dayIndices.length) return prev

        const newSessions = [...prev.sessions]
        const idxA = dayIndices[posInDay]
        const idxB = dayIndices[swapPos]
        const temp = newSessions[idxA]
        newSessions[idxA] = newSessions[idxB]
        newSessions[idxB] = temp

        return { ...prev, sessions: newSessions }
      })
    },
    [updateData]
  )

  const updateSession = useCallback(
    (id: string, updates: Partial<Session>) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      }))
    },
    [updateData]
  )

  const removeSession = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((s) => s.id !== id),
        assignments: prev.assignments.filter((a) => a.sessionId !== id),
      }))
    },
    [updateData]
  )

  // Assignment operations
  const setAssignment = useCallback(
    (sessionId: string, staffId: string, roleId: string) => {
      updateData((prev) => {
        const existing = prev.assignments.findIndex(
          (a) => a.sessionId === sessionId && a.staffId === staffId
        )
        let newAssignments: Assignment[]
        if (roleId === '') {
          newAssignments = prev.assignments.filter(
            (a) => !(a.sessionId === sessionId && a.staffId === staffId)
          )
        } else if (existing >= 0) {
          newAssignments = prev.assignments.map((a, i) =>
            i === existing ? { ...a, roleId } : a
          )
        } else {
          newAssignments = [
            ...prev.assignments,
            { sessionId, staffId, roleId, overrides: [] },
          ]
        }
        return { ...prev, assignments: newAssignments }
      })
    },
    [updateData]
  )

  const setAssignmentNote = useCallback(
    (sessionId: string, staffId: string, note: string) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? { ...a, note }
            : a
        ),
      }))
    },
    [updateData]
  )

  const getAssignment = useCallback(
    (sessionId: string, staffId: string): Assignment | null => {
      return (
        data.assignments.find(
          (a) => a.sessionId === sessionId && a.staffId === staffId
        ) ?? null
      )
    },
    [data.assignments]
  )

  const getAssignmentRoleId = useCallback(
    (sessionId: string, staffId: string): string => {
      const found = data.assignments.find(
        (a) => a.sessionId === sessionId && a.staffId === staffId
      )
      return found?.roleId ?? ''
    },
    [data.assignments]
  )

  // Override operations (offset-based)
  const addOverride = useCallback(
    (
      sessionId: string,
      staffId: string,
      override: Omit<Override, 'id'>
    ) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: [
                  ...(a.overrides || []),
                  { ...override, id: generateId() },
                ],
              }
            : a
        ),
      }), true) // skip recompute - override changes don't affect session times
    },
    [updateData]
  )

  const updateOverride = useCallback(
    (
      sessionId: string,
      staffId: string,
      overrideId: string,
      updates: Partial<Omit<Override, 'id'>>
    ) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: (a.overrides || []).map((o) =>
                  o.id === overrideId ? { ...o, ...updates } : o
                ),
              }
            : a
        ),
      }))
    },
    [updateData]
  )

  const removeOverride = useCallback(
    (sessionId: string, staffId: string, overrideId: string) => {
      updateData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.sessionId === sessionId && a.staffId === staffId
            ? {
                ...a,
                overrides: (a.overrides || []).filter(
                  (o) => o.id !== overrideId
                ),
              }
            : a
        ),
      }))
    },
    [updateData]
  )

  // Milestone operations
  const addMilestone = useCallback(
    (sessionId: string, milestone: Omit<Milestone, 'id'>) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                milestones: [
                  ...(s.milestones || []),
                  { ...milestone, id: generateId() },
                ],
              }
            : s
        ),
      }))
    },
    [updateData]
  )

  const updateMilestone = useCallback(
    (sessionId: string, milestoneId: string, updates: Partial<Omit<Milestone, 'id'>>) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                milestones: (s.milestones || []).map((m) =>
                  m.id === milestoneId ? { ...m, ...updates } : m
                ),
              }
            : s
        ),
      }))
    },
    [updateData]
  )

  const removeMilestone = useCallback(
    (sessionId: string, milestoneId: string) => {
      updateData((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                milestones: (s.milestones || []).filter((m) => m.id !== milestoneId),
              }
            : s
        ),
      }))
    },
    [updateData]
  )

  // Staff Override operations (global, absolute-time overrides)
  const addStaffOverride = useCallback(
    (override: Omit<StaffOverride, 'id'>) => {
      updateData((prev) => ({
        ...prev,
        staffOverrides: [
          ...prev.staffOverrides,
          { ...override, id: generateId() },
        ],
      }), true)
    },
    [updateData]
  )

  const updateStaffOverride = useCallback(
    (id: string, updates: Partial<Omit<StaffOverride, 'id'>>) => {
      updateData((prev) => ({
        ...prev,
        staffOverrides: prev.staffOverrides.map((so) =>
          so.id === id ? { ...so, ...updates } : so
        ),
      }), true)
    },
    [updateData]
  )

  const removeStaffOverride = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        staffOverrides: prev.staffOverrides.filter((so) => so.id !== id),
      }), true)
    },
    [updateData]
  )

  // Grid time settings
  const setGridTimes = useCallback(
    (startTime: string, endTime: string) => {
      updateData((prev) => ({
        ...prev,
        gridStartTime: startTime,
        gridEndTime: endTime,
      }))
    },
    [updateData]
  )

  // Import data
  const importData = useCallback(
    (importedData: Partial<ShiftData>) => {
      updateData((prev) => ({
        ...prev,
        ...importedData,
      }))
    },
    [updateData]
  )

  // Replace entire data (for project restore)
  const replaceData = useCallback(
    (newData: ShiftData) => {
      updateData(() => migrateData(newData as unknown as Record<string, unknown>))
    },
    [updateData]
  )

  // Reset data
  const resetData = useCallback(() => {
    updateData(() => DEFAULT_SHIFT_DATA)
  }, [updateData])

  return {
    data,
    isLoaded,
    addStaff,
    updateStaff,
    removeStaff,
    addRole,
    updateRole,
    removeRole,
    updateDay,
    addSession,
    updateSession,
    removeSession,
    reorderSession,
    setAssignment,
    setAssignmentNote,
    getAssignment,
    getAssignmentRoleId,
    addOverride,
    updateOverride,
    removeOverride,
    addMilestone,
    updateMilestone,
    removeMilestone,
    addStaffOverride,
    updateStaffOverride,
    removeStaffOverride,
    setGridTimes,
    importData,
    replaceData,
    resetData,
  }
}
