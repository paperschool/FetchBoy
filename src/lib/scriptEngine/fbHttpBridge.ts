import type { QuickJSAsyncContext, QuickJSHandle } from 'quickjs-emscripten';
import type { HttpLogEntry, HttpSender } from './types';
import { FB_HTTP_METHODS, HTTP_SUB_REQUEST_TIMEOUT_MS } from './constants';

/** Helper: set a property on an object and dispose the value handle */
function setAndDispose(ctx: QuickJSAsyncContext, obj: QuickJSHandle, key: string, val: QuickJSHandle): void {
  ctx.setProp(obj, key, val);
  val.dispose();
}

export function injectFbHttp(
  ctx: QuickJSAsyncContext,
  fb: QuickJSHandle,
  httpLogs: HttpLogEntry[],
  httpSender: HttpSender | undefined,
): void {
  const httpObj = ctx.newObject();

  for (const method of FB_HTTP_METHODS) {
    const fn = ctx.newAsyncifiedFunction(method, async (urlHandle: QuickJSHandle, optsHandle?: QuickJSHandle) => {
      if (!httpSender) throw new Error('fb.http is not available — no HTTP sender configured');

      const url = ctx.getString(urlHandle);
      const opts = optsHandle
        ? ctx.dump(optsHandle) as { headers?: Record<string, string>; body?: string }
        : undefined;

      const start = Date.now();
      const timeoutId = setTimeout(() => { /* timeout tracking */ }, HTTP_SUB_REQUEST_TIMEOUT_MS);

      try {
        const response = await httpSender(method.toUpperCase(), url, opts);
        const durationMs = Date.now() - start;
        httpLogs.push({ method: method.toUpperCase(), url, status: response.status, durationMs });

        const resultObj = ctx.newObject();
        setAndDispose(ctx, resultObj, 'status', ctx.newNumber(response.status));
        setAndDispose(ctx, resultObj, 'body', ctx.newString(response.body));

        const headersObj = ctx.newObject();
        for (const [k, v] of Object.entries(response.headers)) {
          setAndDispose(ctx, headersObj, k, ctx.newString(v));
        }
        setAndDispose(ctx, resultObj, 'headers', headersObj);

        return resultObj;
      } catch (err) {
        const durationMs = Date.now() - start;
        httpLogs.push({ method: method.toUpperCase(), url, status: 0, durationMs });
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    });
    ctx.setProp(httpObj, method, fn);
    fn.dispose();
  }

  ctx.setProp(fb, 'http', httpObj);
  httpObj.dispose();
}
