import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { saveSetting } from '@/lib/settings'
import { seedSampleDataIfNeeded } from '@/lib/seedSampleData'
import { deleteCollection as deleteCollectionFromDb } from '@/lib/collections'

export function FetchSettings(): React.ReactElement {
    const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs)
    const setRequestTimeoutMs = useUiSettingsStore((s) => s.setRequestTimeoutMs)
    const setHasSeededSampleData = useUiSettingsStore((s) => s.setHasSeededSampleData)

    function handleTimeoutChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const raw = parseInt(e.target.value, 10)
        const clamped = Math.min(300000, Math.max(100, isNaN(raw) ? 100 : raw))
        setRequestTimeoutMs(clamped)
        void saveSetting('request_timeout_ms', clamped)
    }

    async function handleReseed(): Promise<void> {
        // Reset the seed flag so the seeder runs again
        setHasSeededSampleData(false)
        void saveSetting('has_seeded_sample_data', false)
        // Remove the existing sample collection if present
        const collections = useCollectionStore.getState().collections
        const sample = collections.find((c) => c.id === 'sample-getting-started')
        if (sample) {
            useCollectionStore.getState().deleteCollection(sample.id)
            await deleteCollectionFromDb(sample.id).catch(() => {})
        }
        await seedSampleDataIfNeeded()
    }

    return (
        <div className="space-y-4">
            <h3 className="text-app-muted text-xs font-medium uppercase tracking-wide">Fetch</h3>

            {/* Request Timeout */}
            <div className="space-y-1">
                <p className="text-app-muted text-xs font-medium">Request Timeout (ms)</p>
                <input
                    type="number"
                    min={100}
                    max={300000}
                    step={100}
                    value={requestTimeoutMs}
                    onChange={handleTimeoutChange}
                    className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-app-muted text-xs"
                />
            </div>

            {/* Re-seed */}
            <button
                type="button"
                onClick={() => void handleReseed()}
                className="w-full text-left px-2 py-1 text-xs border border-gray-700 rounded text-app-muted hover:bg-gray-700 cursor-pointer transition-colors"
            >
                Re-seed Example Requests
            </button>
        </div>
    )
}
