import type { AuthState } from '@/stores/requestStore';
import { isAuthType } from '@/lib/validators';
import { t } from '@/lib/i18n';

interface AuthPanelProps {
  auth: AuthState;
  onAuthChange: (auth: AuthState) => void;
}

export function AuthPanel({ auth, onAuthChange }: AuthPanelProps) {
  const handleTypeChange = (newType: AuthState['type']) => {
    switch (newType) {
      case 'bearer':
        return onAuthChange({ type: 'bearer', token: '' });
      case 'basic':
        return onAuthChange({ type: 'basic', username: '', password: '' });
      case 'api-key':
        return onAuthChange({ type: 'api-key', key: '', value: '', in: 'header' });
      default:
        return onAuthChange({ type: 'none' });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="auth-type" className="text-app-secondary mb-1 block text-xs font-medium">
          {t('auth.type')}
        </label>
        <select
          id="auth-type"
          value={auth.type}
          onChange={(e) => { const v = e.target.value; if (isAuthType(v)) handleTypeChange(v); }}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-9 rounded-md border pl-2 pr-7 text-sm"
        >
          <option value="none">{t('auth.none')}</option>
          <option value="bearer">{t('auth.bearer')}</option>
          <option value="basic">{t('auth.basic')}</option>
          <option value="api-key">{t('auth.apiKey')}</option>
        </select>
      </div>

      {auth.type === 'none' && (
        <p className="text-app-muted text-sm">No auth will be applied to this request.</p>
      )}

      {auth.type === 'bearer' && (
        <div>
          <label htmlFor="auth-bearer-token" className="text-app-secondary mb-1 block text-xs font-medium">
            {t('auth.token')}
          </label>
          <input
            id="auth-bearer-token"
            type="text"
            value={auth.token}
            onChange={(e) => onAuthChange({ ...auth, token: e.target.value })}
            placeholder={t('auth.tokenPlaceholder')}
            className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="auth-basic-username" className="text-app-secondary mb-1 block text-xs font-medium">
              {t('auth.username')}
            </label>
            <input
              id="auth-basic-username"
              type="text"
              value={auth.username}
              onChange={(e) => onAuthChange({ ...auth, username: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="auth-basic-password" className="text-app-secondary mb-1 block text-xs font-medium">
              {t('auth.password')}
            </label>
            <input
              id="auth-basic-password"
              type="password"
              value={auth.password}
              onChange={(e) => onAuthChange({ ...auth, password: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-2">
          <div>
            <label htmlFor="auth-apikey-name" className="text-app-secondary mb-1 block text-xs font-medium">
              {t('auth.key')}
            </label>
            <input
              id="auth-apikey-name"
              type="text"
              value={auth.key}
              onChange={(e) => onAuthChange({ ...auth, key: e.target.value })}
              placeholder={t('auth.keyPlaceholder')}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="auth-apikey-value" className="text-app-secondary mb-1 block text-xs font-medium">
              {t('auth.value')}
            </label>
            <input
              id="auth-apikey-value"
              type="text"
              value={auth.value}
              onChange={(e) => onAuthChange({ ...auth, value: e.target.value })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="auth-apikey-in" className="text-app-secondary mb-1 block text-xs font-medium">
              {t('auth.addTo')}
            </label>
            <select
              id="auth-apikey-in"
              value={auth.in}
              onChange={(e) => onAuthChange({ ...auth, in: e.target.value as 'header' | 'query' })}
              className="select-flat border-app-subtle bg-app-main text-app-primary h-9 rounded-md border pl-2 pr-7 text-sm"
            >
              <option value="header">{t('auth.header')}</option>
              <option value="query">{t('auth.queryParam')}</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
