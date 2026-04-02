import { AlertCircle, Trash2 } from 'lucide-react';
import type { MappingCookie } from '@/lib/db';
import { createEmptyCookie, validateAllCookies } from './MappingCookieEditor.utils';
import { t } from '@/lib/i18n';

interface Props {
    cookies: MappingCookie[];
    onChange: (cookies: MappingCookie[]) => void;
}

const SAME_SITE_OPTIONS: MappingCookie['sameSite'][] = ['Strict', 'Lax', 'None'];

export function MappingCookieEditor({ cookies, onChange }: Props) {
    const errors = validateAllCookies(cookies);
    const errorFor = (i: number, field: string) => errors.find((e) => e.index === i && e.field === field);

    const addCookie = () => onChange([...cookies, createEmptyCookie()]);
    const removeCookie = (i: number) => onChange(cookies.filter((_, idx) => idx !== i));
    const update = (i: number, field: keyof MappingCookie, val: string | boolean) =>
        onChange(cookies.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));

    return (
        <div className="space-y-3" data-testid="mapping-cookie-editor">
            <div className="flex items-center justify-between">
                <span className="text-app-inverse text-sm font-medium">{t('mappings.cookiesCount', { count: String(cookies.length) })}</span>
                <button type="button" onClick={addCookie}
                    className="text-xs text-app-accent hover:underline" data-testid="add-cookie-btn">
                    {t('mappings.addCookie')}
                </button>
            </div>

            {cookies.map((cookie, i) => (
                <div key={i} className="border border-app-subtle rounded p-2 space-y-2" data-testid={`cookie-row-${i}`}>
                    <div className="flex items-center justify-between">
                        <span className="text-app-muted text-xs">{t('mappings.cookieIndex', { index: String(i + 1) })}</span>
                        <button type="button" onClick={() => removeCookie(i)}
                            className="text-red-400 hover:text-red-300" data-testid={`cookie-delete-${i}`}>
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <input type="text" value={cookie.name} onChange={(e) => update(i, 'name', e.target.value)}
                                placeholder={t('common.name')} data-testid={`cookie-name-${i}`}
                                className={`w-full bg-app-main text-app-inverse border rounded px-2 py-1 text-sm ${errorFor(i, 'name') ? 'border-red-400' : 'border-app-subtle'}`} />
                        </div>
                        <div>
                            <input type="text" value={cookie.value} onChange={(e) => update(i, 'value', e.target.value)}
                                placeholder={t('common.value')} data-testid={`cookie-value-${i}`}
                                className={`w-full bg-app-main text-app-inverse border rounded px-2 py-1 text-sm ${errorFor(i, 'value') ? 'border-red-400' : 'border-app-subtle'}`} />
                        </div>
                        <div>
                            <input type="text" value={cookie.domain} onChange={(e) => update(i, 'domain', e.target.value)}
                                placeholder={t('mappings.domain')} data-testid={`cookie-domain-${i}`}
                                className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm" />
                        </div>
                        <div>
                            <input type="text" value={cookie.path} onChange={(e) => update(i, 'path', e.target.value)}
                                placeholder={t('mappings.path')} data-testid={`cookie-path-${i}`}
                                className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-1.5 text-xs text-app-secondary">
                            <input type="checkbox" checked={cookie.secure} onChange={(e) => update(i, 'secure', e.target.checked)}
                                data-testid={`cookie-secure-${i}`} />
                            {t('mappings.secure')}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-app-secondary">
                            <input type="checkbox" checked={cookie.httpOnly} onChange={(e) => update(i, 'httpOnly', e.target.checked)}
                                data-testid={`cookie-httponly-${i}`} />
                            {t('mappings.httpOnly')}
                        </label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-app-muted">{t('mappings.sameSite')}</span>
                            <select value={cookie.sameSite} onChange={(e) => update(i, 'sameSite', e.target.value)}
                                data-testid={`cookie-samesite-${i}`}
                                className="select-flat border-app-subtle bg-app-main text-app-primary h-6 rounded border pl-1 pr-5 text-xs">
                                {SAME_SITE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <input type="text" value={cookie.expires} onChange={(e) => update(i, 'expires', e.target.value)}
                            placeholder={t('mappings.expires')} data-testid={`cookie-expires-${i}`}
                            className={`w-full bg-app-main text-app-inverse border rounded px-2 py-1 text-sm ${errorFor(i, 'expires') ? 'border-red-400' : 'border-app-subtle'}`} />
                    </div>
                    {errors.filter((e) => e.index === i).map((err, j) => (
                        <p key={j} className="text-red-400 text-xs flex items-center gap-1" data-testid={`cookie-error-${i}-${err.field}`}>
                            <AlertCircle size={12} /> {err.message}
                        </p>
                    ))}
                </div>
            ))}

            {cookies.length === 0 && (
                <p className="text-app-muted text-xs">{t('mappings.noCookies')}</p>
            )}
        </div>
    );
}
