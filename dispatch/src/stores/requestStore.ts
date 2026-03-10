import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface RequestState {
    method: string;
    url: string;
    setMethod: (method: string) => void;
    setUrl: (url: string) => void;
}

export const useRequestStore = create<RequestState>()(
    immer((set) => ({
        method: 'GET',
        url: '',
        setMethod: (method) =>
            set((state) => {
                state.method = method;
            }),
        setUrl: (url) =>
            set((state) => {
                state.url = url;
            }),
    })),
);
