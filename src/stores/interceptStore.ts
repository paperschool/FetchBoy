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
  isPending?: boolean
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
  queryParams?: [string, string][]
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

  // Inline edit mode
  editMode: boolean
  pendingMods: BreakpointModifications

  addRequest: (request: InterceptRequest) => void
  addPendingRequest: (payload: import('@/types/intercept').InterceptRequestSplitPayload) => void
  updateWithResponse: (payload: import('@/types/intercept').InterceptResponseSplitPayload) => void
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
  editAndResume: (modifications?: BreakpointModifications) => Promise<void>
  setBreakpointTimeout: (seconds: number) => void
  clearPauseState: () => void

  // Inline edit mode actions
  enterEditMode: () => void
  updatePendingMods: (mods: Partial<BreakpointModifications>) => void
  exitEditMode: () => void
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

  editMode: false,
  pendingMods: {},

  addRequest: (request) => set((state) => {
    // Update existing entry (pending or paused) if it arrives with final data.
    const existing = state.requests.find((r) => r.id === request.id)
    if (existing) {
      return {
        requests: state.requests.map((r) => r.id === request.id ? { ...r, ...request, isPending: false } : r),
      }
    }
    return { requests: [...state.requests, request] }
  }),

  addPendingRequest: (payload) => set((state) => {
    // Skip if a request with this ID already exists (e.g. from combined event race).
    if (state.requests.some((r) => r.id === payload.id)) return state
    const pending: InterceptRequest = {
      id: payload.id,
      timestamp: payload.timestamp,
      method: payload.method,
      host: payload.host,
      path: payload.path,
      requestHeaders: payload.requestHeaders,
      requestBody: payload.requestBody,
      isPending: true,
    }
    return { requests: [...state.requests, pending] }
  }),

  updateWithResponse: (payload) => set((state) => {
    const existing = state.requests.find((r) => r.id === payload.id)
    if (!existing) return state
    return {
      requests: state.requests.map((r) =>
        r.id === payload.id
          ? {
              ...r,
              statusCode: payload.statusCode,
              responseHeaders: payload.responseHeaders,
              responseBody: payload.responseBody,
              contentType: payload.contentType,
              size: payload.size,
              isBlocked: payload.isBlocked,
              isPending: false,
            }
          : r,
      ),
    }
  }),

  clearRequests: () => set({
    requests: [],
    selectedRequestId: null,
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

  pauseAtBreakpoint: (request, breakpointId, breakpointName, timeoutAt) => {
    const paused = { ...request, isPaused: true }

    const extraHeaders: [string, string][] = Object.entries(request.responseHeaders ?? {}).map(
      ([k, v]) => [k, v]
    )
    let queryParams: [string, string][] = []
    try {
      const search = request.path?.includes('?')
        ? request.path.slice(request.path.indexOf('?'))
        : ''
      queryParams = Array.from(new URLSearchParams(search).entries()) as [string, string][]
    } catch { /* ignore */ }
    let responseBody = request.responseBody ?? ''
    try {
      responseBody = JSON.stringify(JSON.parse(responseBody), null, 2)
    } catch { /* not JSON */ }

    set((state) => {
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
        editMode: true,
        pendingMods: {
          statusCode: request.statusCode,
          responseBody,
          contentType: request.contentType ?? '',
          extraHeaders,
          queryParams,
        },
      }
    })
  },

  continueRequest: async () => {
    const { pausedRequest } = get()
    if (!pausedRequest) return
    set({ pauseState: 'resuming', editMode: false, pendingMods: {} })
    try {
      await invoke('resume_request', { requestId: pausedRequest.request.id, action: 'continue' })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  dropRequest: async () => {
    const { pausedRequest } = get()
    if (!pausedRequest) return
    set({ pauseState: 'resuming', editMode: false, pendingMods: {} })
    try {
      await invoke('resume_request', { requestId: pausedRequest.request.id, action: 'drop' })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  editAndResume: async (modifications?: BreakpointModifications) => {
    const { pausedRequest, pendingMods } = get()
    if (!pausedRequest) return
    const mods = modifications ?? pendingMods
    set({ pauseState: 'resuming', editMode: false, pendingMods: {} })
    try {
      await invoke('resume_request', {
        requestId: pausedRequest.request.id,
        action: 'modify',
        statusCode: mods.statusCode ?? null,
        responseBody: mods.responseBody ?? null,
        contentType: mods.contentType ?? null,
        extraHeaders: mods.extraHeaders ?? null,
      })
    } finally {
      set({ pauseState: 'idle', pausedRequest: null })
    }
  },

  setBreakpointTimeout: (seconds) => {
    set({ breakpointTimeout: seconds })
    invoke('set_pause_timeout', { seconds }).catch(() => {})
  },

  clearPauseState: () => set({ pauseState: 'idle', pausedRequest: null, editMode: false, pendingMods: {} }),

  enterEditMode: (request?: InterceptRequest) => {
    const req = request ?? get().pausedRequest?.request
    if (!req) return

    const extraHeaders: [string, string][] = Object.entries(req.responseHeaders ?? {}).map(
      ([k, v]) => [k, v]
    )

    let queryParams: [string, string][] = []
    try {
      const search = req.path?.includes('?')
        ? req.path.slice(req.path.indexOf('?'))
        : ''
      queryParams = Array.from(new URLSearchParams(search).entries()) as [string, string][]
    } catch { /* ignore */ }

    let responseBody = req.responseBody ?? ''
    try {
      responseBody = JSON.stringify(JSON.parse(responseBody), null, 2)
    } catch { /* not JSON — leave as-is */ }

    set({
      editMode: true,
      pendingMods: {
        statusCode: req.statusCode,
        responseBody,
        contentType: req.contentType ?? '',
        extraHeaders,
        queryParams,
      },
    })
  },

  updatePendingMods: (mods) => set((state) => ({
    pendingMods: { ...state.pendingMods, ...mods },
  })),

  exitEditMode: () => set({ editMode: false, pendingMods: {} }),
}))
