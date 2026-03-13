import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface InterceptRequest {
  id: string
  timestamp: number
  method: string
  host: string
  path: string
  statusCode?: number
  contentType?: string
  size?: number
  responseBody?: string
  requestHeaders?: Record<string, string>
  requestBody?: string
  responseHeaders?: Record<string, string>
  isPaused?: boolean
  isBlocked?: boolean
}

export type PauseState = 'idle' | 'paused' | 'waiting-for-action' | 'resuming'

export interface PausedRequestInfo {
  request: InterceptRequest
  breakpointId: string
  breakpointName: string
  pausedAt: number   // ms timestamp
  timeoutAt: number  // unix seconds timestamp
}

export interface BreakpointModifications {
  statusCode?: number
  responseBody?: string
  contentType?: string
  extraHeaders?: [string, string][]
}

interface InterceptStore {
  requests: InterceptRequest[]
  selectedRequestId: string | null
  searchQuery: string
  searchMode: 'fuzzy' | 'regex'
  verbFilter: string | null
  statusFilter: string | null

  // Pause state
  pauseState: PauseState
  pausedRequest: PausedRequestInfo | null
  breakpointTimeout: number // seconds; 0 = never

  addRequest: (request: InterceptRequest) => void
  clearRequests: () => void
  setSelectedRequestId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSearchMode: (mode: 'fuzzy' | 'regex') => void
  setVerbFilter: (verb: string | null) => void
  setStatusFilter: (status: string | null) => void
  clearFilters: () => void

  // Pause actions
  pauseAtBreakpoint: (
    request: InterceptRequest,
    breakpointId: string,
    breakpointName: string,
    timeoutAt: number,
  ) => void
  continueRequest: () => Promise<void>
  dropRequest: () => Promise<void>
  editAndResume: (modifications: BreakpointModifications) => Promise<void>
  setBreakpointTimeout: (seconds: number) => void
  clearPauseState: () => void
}

export const useInterceptStore = create<InterceptStore>((set, get) => ({
  requests: [],
  selectedRequestId: null,
  searchQuery: '',
  searchMode: 'fuzzy',
  verbFilter: null,
  statusFilter: null,

  pauseState: 'idle',
  pausedRequest: null,
  breakpointTimeout: 30,

  addRequest: (request) => set((state) => {
    // Update existing paused request entry if it arrives with final data.
    const existing = state.requests.find((r) => r.id === request.id)
    if (existing) {
      return {
        requests: state.requests.map((r) => r.id === request.id ? { ...r, ...request } : r),
      }
    }
    return { requests: [...state.requests, request] }
  }),

  clearRequests: () => set({
    requests: [],
    selectedRequestId: null,
    searchQuery: '',
    searchMode: 'fuzzy',
    verbFilter: null,
    statusFilter: null,
  }),

  setSelectedRequestId: (id) => set({ selectedRequestId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  setVerbFilter: (verb) => set({ verbFilter: verb }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  clearFilters: () => set({
    searchQuery: '',
    searchMode: 'fuzzy',
    verbFilter: null,
    statusFilter: null,
  }),

  pauseAtBreakpoint: (request, breakpointId, breakpointName, timeoutAt) =>
    set((state) => {
      // Add a placeholder entry in the request list so the table shows it as paused.
      const paused = { ...request, isPaused: true }
      const alreadyExists = state.requests.some((r) => r.id === request.id)
      return {
        pauseState: 'paused',
        pausedRequest: {
          request: paused,
          breakpointId,
          breakpointName,
          pausedAt: Date.now(),
          timeoutAt,
        },
        requests: alreadyExists
          ? state.requests.map((r) => r.id === request.id ? paused : r)
          : [...state.requests, paused],
        selectedRequestId: request.id,
      }
    }),

  continueRequest: async () => {
    const { pausedRequest } = get()
    if (!pausedRequest) return
    set({ pauseState: 'resuming' })
    try {
      await invoke('resume_request', { requestId: pausedRequest.request.id, action: 'continue' })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  dropRequest: async () => {
    const { pausedRequest } = get()
    if (!pausedRequest) return
    set({ pauseState: 'resuming' })
    try {
      await invoke('resume_request', { requestId: pausedRequest.request.id, action: 'drop' })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  editAndResume: async (modifications: BreakpointModifications) => {
    const { pausedRequest } = get()
    if (!pausedRequest) return
    set({ pauseState: 'resuming' })
    try {
      await invoke('resume_request', {
        requestId: pausedRequest.request.id,
        action: 'modify',
        statusCode: modifications.statusCode ?? null,
        responseBody: modifications.responseBody ?? null,
        contentType: modifications.contentType ?? null,
        extraHeaders: modifications.extraHeaders ?? null,
      })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  setBreakpointTimeout: (seconds) => {
    set({ breakpointTimeout: seconds })
    invoke('set_pause_timeout', { seconds }).catch(() => {})
  },

  clearPauseState: () => set({ pauseState: 'idle', pausedRequest: null }),
}))
