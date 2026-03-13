import { create } from 'zustand'

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
}

interface InterceptStore {
  requests: InterceptRequest[]
  selectedRequestId: string | null
  searchQuery: string
  searchMode: 'fuzzy' | 'regex'
  verbFilter: string | null
  statusFilter: string | null

  addRequest: (request: InterceptRequest) => void
  clearRequests: () => void
  setSelectedRequestId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setSearchMode: (mode: 'fuzzy' | 'regex') => void
  setVerbFilter: (verb: string | null) => void
  setStatusFilter: (status: string | null) => void
  clearFilters: () => void
}

export const useInterceptStore = create<InterceptStore>((set) => ({
  requests: [],
  selectedRequestId: null,
  searchQuery: '',
  searchMode: 'fuzzy',
  verbFilter: null,
  statusFilter: null,

  addRequest: (request) => set((state) => {
    if (state.requests.some((r) => r.id === request.id)) return state
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
}))
