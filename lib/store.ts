'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ShiftData, StaffMember, Role, Session, Assignment } from './types'
import { DEFAULT_SHIFT_DATA, generateId } from './types'

const STORAGE_KEY = 'shift-manager-data'

function loadData(): ShiftData {
  if (typeof window === 'undefined') return DEFAULT_SHIFT_DATA
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as ShiftData
    }
  } catch {
    // ignore parse errors
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

  const updateData = useCallback((updater: (prev: ShiftData) => ShiftData) => {
    setData(prev => {
      const next = updater(prev)
      saveData(next)
      return next
    })
  }, [])

  // Staff operations
  const addStaff = useCallback((name: string) => {
    updateData(prev => ({
      ...prev,
      staff: [...prev.staff, { id: generateId(), name }],
    }))
  }, [updateData])

  const updateStaff = useCallback((id: string, name: string) => {
    updateData(prev => ({
      ...prev,
      staff: prev.staff.map(s => (s.id === id ? { ...s, name } : s)),
    }))
  }, [updateData])

  const removeStaff = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      staff: prev.staff.filter(s => s.id !== id),
      assignments: prev.assignments.filter(a => a.staffId !== id),
    }))
  }, [updateData])

  // Role operations
  const addRole = useCallback((name: string, color: string, textColor: string) => {
    updateData(prev => ({
      ...prev,
      roles: [...prev.roles, { id: generateId(), name, color, textColor }],
    }))
  }, [updateData])

  const updateRole = useCallback((id: string, updates: Partial<Role>) => {
    updateData(prev => ({
      ...prev,
      roles: prev.roles.map(r => (r.id === id ? { ...r, ...updates } : r)),
    }))
  }, [updateData])

  const removeRole = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      roles: prev.roles.filter(r => r.id !== id),
      assignments: prev.assignments.filter(a => a.roleId !== id),
    }))
  }, [updateData])

  // Session operations
  const addSession = useCallback((title: string, startTime: string, endTime: string) => {
    updateData(prev => ({
      ...prev,
      sessions: [...prev.sessions, { id: generateId(), title, startTime, endTime }],
    }))
  }, [updateData])

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    updateData(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => (s.id === id ? { ...s, ...updates } : s)),
    }))
  }, [updateData])

  const removeSession = useCallback((id: string) => {
    updateData(prev => ({
      ...prev,
      sessions: prev.sessions.filter(s => s.id !== id),
      assignments: prev.assignments.filter(a => a.sessionId !== id),
    }))
  }, [updateData])

  // Assignment operations
  const setAssignment = useCallback((sessionId: string, staffId: string, roleId: string) => {
    updateData(prev => {
      const existing = prev.assignments.findIndex(
        a => a.sessionId === sessionId && a.staffId === staffId
      )
      let newAssignments: Assignment[]
      if (roleId === '') {
        // Remove assignment
        newAssignments = prev.assignments.filter(
          a => !(a.sessionId === sessionId && a.staffId === staffId)
        )
      } else if (existing >= 0) {
        // Update existing
        newAssignments = prev.assignments.map((a, i) =>
          i === existing ? { ...a, roleId } : a
        )
      } else {
        // Add new
        newAssignments = [...prev.assignments, { sessionId, staffId, roleId }]
      }
      return { ...prev, assignments: newAssignments }
    })
  }, [updateData])

  const getAssignment = useCallback((sessionId: string, staffId: string): string => {
    const found = data.assignments.find(
      a => a.sessionId === sessionId && a.staffId === staffId
    )
    return found?.roleId ?? ''
  }, [data.assignments])

  // Grid time settings
  const setGridTimes = useCallback((startTime: string, endTime: string) => {
    updateData(prev => ({ ...prev, gridStartTime: startTime, gridEndTime: endTime }))
  }, [updateData])

  // Import data
  const importData = useCallback((importedData: Partial<ShiftData>) => {
    updateData(prev => ({
      ...prev,
      ...importedData,
    }))
  }, [updateData])

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
    addSession,
    updateSession,
    removeSession,
    setAssignment,
    getAssignment,
    setGridTimes,
    importData,
    resetData,
  }
}
