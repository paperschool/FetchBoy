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
}

interface InterceptStore {
  requests: InterceptRequest[]
  addRequest: (request: InterceptRequest) => void
  clearRequests: () => void
}

export const useInterceptStore = create<InterceptStore>((set) => ({
  requests: [],
  addRequest: (request) => set((state) => ({
    requests: [...state.requests, request],
  })),
  clearRequests: () => set({ requests: [] }),
}))
