import { TimeoutConfig } from "@/components/Breakpoints/TimeoutConfig";

interface ProxyPortConfigProps {
  portInput: string;
  proxyEnabled: boolean;
  breakpointTimeout: number;
  onPortInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPortCommit: () => void;
  onTimeoutChange: (t: number) => void;
}

export function ProxyPortConfig({
  portInput,
  proxyEnabled,
  breakpointTimeout,
  onPortInput,
  onPortCommit,
  onTimeoutChange,
}: ProxyPortConfigProps): React.ReactElement {
  return (
    <>
      <div className="space-y-2">
        <p className="text-app-muted text-xs font-medium">Proxy</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-muted w-8">Port</span>
          <input
            type="number"
            min={1024}
            max={65535}
            value={portInput}
            onChange={onPortInput}
            onBlur={onPortCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') onPortCommit() }}
            disabled={proxyEnabled}
            className="w-16 bg-transparent border border-gray-700 rounded px-2 py-1 text-app-muted text-xs disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-gray-700">
        <p className="text-app-muted text-xs font-medium">Breakpoints</p>
        <TimeoutConfig timeout={breakpointTimeout} onChange={onTimeoutChange} />
      </div>
    </>
  );
}
