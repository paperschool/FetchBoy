import { AlertCircle } from 'lucide-react';
import { MATCH_TYPES, PLACEHOLDERS, MATCH_DESCRIPTIONS, validateUrlPattern } from '@/lib/urlPatternConfig';
import type { MatchType } from '@/lib/urlPatternConfig';

interface UrlPatternInputProps {
  urlPattern: string;
  onUrlPatternChange: (value: string) => void;
  matchType: MatchType;
  onMatchTypeChange: (type: MatchType) => void;
  matchCount?: number | null;
  urlError?: string | null;
  testIdPrefix?: string;
}

export function UrlPatternInput({
  urlPattern,
  onUrlPatternChange,
  matchType,
  onMatchTypeChange,
  matchCount,
  urlError,
  testIdPrefix = '',
}: UrlPatternInputProps): React.ReactElement {
  const computedError = urlError ?? validateUrlPattern(urlPattern, matchType);
  const showMatchCount = matchCount !== null && matchCount !== undefined && !computedError && urlPattern.trim();

  return (
    <>
      <div>
        <label className="block text-app-muted text-xs mb-1">URL Pattern</label>
        <input
          type="text"
          value={urlPattern}
          onChange={(e) => onUrlPatternChange(e.target.value)}
          placeholder={PLACEHOLDERS[matchType]}
          className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
          data-testid={`${testIdPrefix}url-input`}
        />
        {computedError && urlPattern.trim() && (
          <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid={`${testIdPrefix}url-error`}>
            <AlertCircle size={12} /> {computedError}
          </p>
        )}
        {showMatchCount && (
          <p className="text-app-muted text-xs mt-1">
            History matches: <span className={matchCount > 0 ? 'text-green-400' : 'text-app-muted'}>{matchCount}</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-app-muted text-xs mb-1">Match Type</label>
        <div className="flex gap-1 flex-wrap">
          {MATCH_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => {
                if (type === 'wildcard' && urlPattern && !urlPattern.startsWith('*') && !/^https?:\/\//.test(urlPattern)) {
                  onUrlPatternChange('*' + urlPattern);
                }
                onMatchTypeChange(type);
              }}
              className={`px-3 py-1 text-xs rounded ${
                matchType === type
                  ? 'bg-app-accent text-white'
                  : 'bg-app-subtle text-app-muted hover:text-app-inverse'
              }`}
              data-testid={`${testIdPrefix}match-type-${type}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-app-muted text-[11px] mt-1.5 leading-snug">{MATCH_DESCRIPTIONS[matchType]}</p>
      </div>
    </>
  );
}
