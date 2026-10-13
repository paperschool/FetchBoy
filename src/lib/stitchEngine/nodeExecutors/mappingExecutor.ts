import type { StitchNode, StitchConnection, ExecutionCallbacks, MappingExitNodeConfig } from '@/types/stitch';
import { topologicalSort } from '../topologicalSort';
import { resolveNodeInputs } from '../inputResolution';
import { createExecutionContext } from '../chainExecutor';
import { getUpstreamNodes } from '../graphSlicing';
import { executeJsonObjectNode } from './jsonObjectExecutor';
import { executeJsSnippetNode } from './jsSnippetExecutor';
import { executeRequestNode } from './requestExecutor';
import { executeSleepNode } from './sleepExecutor';
import { executeLogNode } from './logExecutor';

// Keys Entry→Response wiring exists for (firing the outbound request) —
// distinct from Response's other ports (e.g. cookies) which still serve the
// older "shape the reply" purpose.
const REQUEST_FIRING_KEYS = ['method', 'headers', 'body', 'url'] as const;

/**
 * Nodes that exist *only* to compute Response's request-firing ports (e.g. a
 * transform feeding Response.url) — reachable upstream of Response, minus
 * Entry itself (still needed for its own visibility/other legitimate uses
 * like forwarding cookies) — and with no OTHER outgoing connection outside
 * that segment. `executeMappingRequestSegment` (the request-side pause)
 * already ran this exact segment for real, once, to decide what to actually
 * fire; by the time this (response-shaping) run happens, its job is done —
 * Response's request-firing keys just default to the real fired
 * method/url/headers/body instead (see the `executeMappingNode` loop below).
 * Re-running these nodes here would silently double their real-world side
 * effects — most visibly a Sleep node's delay firing a second time.
 */
function findRequestOnlyChildIds(
  entryNode: StitchNode | undefined,
  responseNode: StitchNode,
  childNodes: StitchNode[],
  childConnections: StitchConnection[],
): Set<string> {
  const upstream = getUpstreamNodes(responseNode.id, childNodes, childConnections);
  const candidateIds = new Set(
    upstream.map((n) => n.id).filter((id) => id !== responseNode.id && id !== entryNode?.id),
  );
  const requestOnlyIds = new Set<string>();
  for (const id of candidateIds) {
    const onlyFeedsRequestSegment = childConnections
      .filter((c) => c.sourceNodeId === id)
      .every((c) => c.targetNodeId === responseNode.id || candidateIds.has(c.targetNodeId));
    if (onlyFeedsRequestSegment) requestOnlyIds.add(id);
  }
  return requestOnlyIds;
}

export function executeMappingEntryNode(
  _node: StitchNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  // Entry always represents the real inbound request — headers here are the
  // client's request headers, so a `Cookie` header (not `Set-Cookie`) is what
  // we parse. Previously this node was fed response headers, which never
  // carry a `Cookie` header, so the parsed object always came out empty.
  const hdrs = (input.headers as Record<string, string>) ?? {};
  const cookieStr = hdrs['cookie'] ?? hdrs['Cookie'] ?? '';
  const cookies: Record<string, string> = {};
  if (cookieStr) {
    for (const pair of cookieStr.split(';')) {
      const [k, ...v] = pair.split('=');
      if (k?.trim()) cookies[k.trim()] = v.join('=').trim();
    }
  }
  return {
    method: input.method ?? 'GET',
    headers: input.headers ?? {},
    cookies,
    body: input.body ?? {},
    url: input.url ?? '',
  };
}

/** The "wire" node — injects the real upstream response into the chain. Each
 * field defaults to the actual response FetchBoy received; wiring something
 * into a given input port overrides just that field, so unwired fields still
 * reflect the real response. `status` has no input port — it only exists on
 * the response side, so an override port for it would misleadingly suggest
 * you could "set the status of the request"; override the final status by
 * rewiring Exit's status input directly instead. */
export function executeMappingResponseNode(
  _node: StitchNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  return {
    status: input.status ?? 200,
    headers: input.headers ?? {},
    cookies: input.cookies ?? {},
    body: input.body ?? {},
    url: input.url ?? '',
  };
}

/** Replace {{key}} placeholders in a template with values from the node input. */
function interpolateFromInput(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    input[key] !== undefined ? String(input[key]) : match,
  );
}

export function executeMappingExitNode(
  node: StitchNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const config = node.config as unknown as MappingExitNodeConfig;

  const status = input.status ?? config.status ?? 200;

  let headers: Record<string, string> = {};
  if (input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers)) {
    headers = { ...(input.headers as Record<string, string>) };
  } else {
    for (const h of config.headers ?? []) {
      if (h.key) headers[h.key] = interpolateFromInput(h.value, input);
    }
  }

  // Each cookie becomes its own Set-Cookie string — RFC 6265 forbids folding
  // multiple Set-Cookie values into one comma-joined header (an Expires
  // attribute itself contains a comma, so a joined string can't be parsed
  // back apart; the receiving client would see one mangled cookie).
  let setCookies: string[];
  if (input.cookies && typeof input.cookies === 'object' && !Array.isArray(input.cookies)) {
    setCookies = Object.entries(input.cookies as Record<string, string>).map(([k, v]) => `${k}=${v}`);
  } else {
    setCookies = (config.cookies ?? [])
      .filter((c) => c.key)
      .map((c) => `${c.key}=${interpolateFromInput(c.value, input)}`);
  }

  let body: unknown;
  if (input.body !== undefined && input.body !== null) {
    body = typeof input.body === 'object' ? JSON.stringify(input.body) : input.body;
  } else {
    body = interpolateFromInput(String(config.body ?? ''), input);
  }

  return {
    status,
    headers,
    setCookies,
    body,
    bodyContentType: config.bodyContentType ?? 'application/json',
  };
}

export async function executeMappingNode(
  mappingNode: StitchNode,
  input: Record<string, unknown>,
  allNodes: StitchNode[],
  allConnections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
  // True only for the live proxy's response-shaping run, which always
  // follows a real executeMappingRequestSegment pre-pass for the same
  // request (see findRequestOnlyChildIds). A one-shot manual "Play" test run
  // (via executeChain) has no such pre-pass, so it must still run everything.
  requestPhaseAlreadyRan = false,
): Promise<Record<string, unknown>> {
  // Entry/Response/Exit — and anything added via the toolbar afterwards —
  // are created as top-level siblings of the mapping container (parentNodeId
  // null), not nested under it, so "this mapping's children" in practice
  // means every top-level, non-mapping node in the chain. Some legacy chains
  // instead have entry/exit correctly parented to the container's real id;
  // match both so a chain mixing old (container-parented) and new
  // (top-level) nodes doesn't silently drop the new ones — that previously
  // meant any node added to an existing chain (e.g. a JS Snippet after
  // Response) ran with zero indication: no log entry, no error, nothing.
  // Nodes nested inside a loop (parentNodeId = the loop's id) are correctly
  // excluded here; they're handled recursively when the loop itself runs.
  const childNodes = allNodes.filter(
    (n) => n.id !== mappingNode.id && n.type !== 'mapping' && (n.parentNodeId === mappingNode.id || n.parentNodeId === null),
  );

  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const childConnections = allConnections.filter(
    (c) => childNodeIds.has(c.sourceNodeId) && childNodeIds.has(c.targetNodeId),
  );

  if (childNodes.length === 0) return {};

  let sortedChildren: StitchNode[];
  try {
    sortedChildren = topologicalSort(childNodes, childConnections);
  } catch (err) {
    throw new Error(`Mapping node "${mappingNode.label ?? mappingNode.id}": ${(err as Error).message}`);
  }

  const exitNode = sortedChildren.find((n) => n.type === 'mapping-exit');
  const exitNodeId = exitNode?.id ?? sortedChildren[sortedChildren.length - 1].id;
  const entryNode = sortedChildren.find((n) => n.type === 'mapping-entry');
  const responseNode = sortedChildren.find((n) => n.type === 'mapping-response');
  const requestOnlyChildIds = responseNode && requestPhaseAlreadyRan
    ? findRequestOnlyChildIds(entryNode, responseNode, childNodes, childConnections)
    : new Set<string>();

  const ctx = createExecutionContext();

  for (const childNode of sortedChildren) {
    if (cancelledRef.current) break;
    // Already ran for real in the request-firing segment — see
    // findRequestOnlyChildIds's doc for why re-running it here (and, for a
    // Sleep node, re-incurring its delay) would be redundant.
    if (requestOnlyChildIds.has(childNode.id)) continue;

    callbacks.onNodeStart(childNode.id);
    const childStart = Date.now();

    // Entry→Response is wired by default (for method/headers/body/url) so the
    // request-side pause can read "what to fire" from Response's inputs — but
    // those specific keys must NOT leak into this (response-shaping) run, or
    // an Entry real value (e.g. an empty body on a GET) would silently
    // overwrite the real reply's body. Entry→Response.cookies is unaffected —
    // that's the existing, legitimate "forward the request's session cookie
    // into the reply" pattern, unrelated to firing a request.
    const inputConnections =
      childNode.type === 'mapping-response' && entryNode
        ? childConnections.filter(
          (c) =>
            !(
              c.targetNodeId === childNode.id &&
              c.sourceNodeId === entryNode.id &&
              c.sourceKey != null &&
              (REQUEST_FIRING_KEYS as readonly string[]).includes(c.sourceKey)
            ),
        )
        : childConnections;
    const wiredInput = resolveNodeInputs(childNode.id, inputConnections, ctx);

    // Real data seeds the defaults; anything actually wired in (e.g. a
    // transform feeding Response's headers/body/cookies/url) overrides just
    // that key. Response has no wireable 'status' port, so status always
    // stays the real value here — override it at Exit instead.
    let childInput: Record<string, unknown>;
    if (childNode.type === 'mapping-entry') {
      childInput = {
        method: input.requestMethod,
        headers: input.requestHeaders,
        body: input.requestBody,
        url: input.url,
        ...wiredInput,
      };
    } else if (childNode.type === 'mapping-response') {
      childInput = {
        status: input.status,
        headers: input.headers,
        body: input.body,
        url: input.url,
        ...wiredInput,
      };
    } else {
      childInput = wiredInput;
    }

    let output: unknown;
    let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;

    try {
      switch (childNode.type) {
        case 'mapping-entry':
          output = executeMappingEntryNode(childNode, childInput);
          break;
        case 'mapping-response':
          output = executeMappingResponseNode(childNode, childInput);
          break;
        case 'mapping-exit':
          output = executeMappingExitNode(childNode, childInput);
          break;
        case 'json-object':
          output = executeJsonObjectNode(childNode);
          break;
        case 'js-snippet': {
          const jsResult = executeJsSnippetNode(childNode, childInput);
          output = jsResult.output;
          consoleLogs = jsResult.consoleLogs.length > 0 ? jsResult.consoleLogs : undefined;
          break;
        }
        case 'request':
          output = await executeRequestNode(childNode, childInput, envVariables);
          break;
        case 'sleep':
          output = await executeSleepNode(childNode, childInput, callbacks, cancelledRef);
          break;
        case 'log': {
          const logResult = executeLogNode(childNode, childInput);
          output = logResult.output;
          consoleLogs = logResult.consoleLogs;
          break;
        }
        default:
          throw new Error(`Unsupported node type in mapping: ${childNode.type}`);
      }
    } catch (err) {
      // Previously uncaught here — the error would bubble past this node
      // entirely, so `onError` never fired for the actual failing child:
      // its "running" highlight never cleared (stuck animating forever)
      // and no error ever reached the debug log. Report it against the real
      // child node, then mark it so the outer chain executor (which wraps
      // this whole mapping node call) doesn't re-report it against the
      // mapping container instead.
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onError(childNode.id, message);
      const reported = new Error(message);
      (reported as Error & { stitchErrorReported?: boolean }).stitchErrorReported = true;
      throw reported;
    }

    ctx.nodeOutputs[childNode.id] = output;
    callbacks.onNodeComplete(childNode.id, output, Date.now() - childStart, undefined, consoleLogs);
  }


  return (ctx.nodeOutputs[exitNodeId] ?? {}) as Record<string, unknown>;
}

export interface MappingRequestSegmentResult {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Runs only the subset of a mapping chain that Response (transitively)
 * depends on — used by the request-side pause, which fires *before* a
 * response exists, so it can't run the full entry+response+exit graph like
 * `executeMappingNode` does. Response is where the (possibly modified) call
 * is actually fired; its wired inputs (if any) override the real captured
 * request, defaulting to it otherwise.
 */
export async function executeMappingRequestSegment(
  mappingNode: StitchNode,
  input: { method: string; url: string; headers: Record<string, string>; body: unknown },
  allNodes: StitchNode[],
  allConnections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
): Promise<MappingRequestSegmentResult> {
  // Same child-discovery filter as executeMappingNode — see the comment there
  // for why both container-parented and top-level shapes must be matched.
  const childNodes = allNodes.filter(
    (n) => n.id !== mappingNode.id && n.type !== 'mapping' && (n.parentNodeId === mappingNode.id || n.parentNodeId === null),
  );
  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const childConnections = allConnections.filter(
    (c) => childNodeIds.has(c.sourceNodeId) && childNodeIds.has(c.targetNodeId),
  );

  const responseNode = childNodes.find((n) => n.type === 'mapping-response');
  if (!responseNode) {
    // Shouldn't happen — needs_request_chain requires Response to exist and
    // be wired — but fail safe by forwarding the real request untouched.
    return { method: input.method, url: input.url, headers: input.headers, body: input.body };
  }

  const upstream = getUpstreamNodes(responseNode.id, childNodes, childConnections);
  const upstreamIds = new Set(upstream.map((n) => n.id));
  const segmentConnections = childConnections.filter(
    (c) => upstreamIds.has(c.sourceNodeId) && upstreamIds.has(c.targetNodeId),
  );

  let sortedSegment: StitchNode[];
  try {
    sortedSegment = topologicalSort(upstream, segmentConnections);
  } catch (err) {
    throw new Error(`Mapping node "${mappingNode.label ?? mappingNode.id}": ${(err as Error).message}`);
  }

  const ctx = createExecutionContext();

  for (const childNode of sortedSegment) {
    if (cancelledRef.current) break;

    callbacks.onNodeStart(childNode.id);
    const childStart = Date.now();

    const wiredInput = resolveNodeInputs(childNode.id, segmentConnections, ctx);

    // Entry always represents the real, untouched inbound request — it has no
    // input ports of its own; any request modification happens downstream of
    // it, landing on Response's inputs instead.
    const childInput: Record<string, unknown> =
      childNode.type === 'mapping-entry'
        ? { method: input.method, headers: input.headers, body: input.body, url: input.url }
        : wiredInput;

    let output: unknown;
    let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;

    try {
      switch (childNode.type) {
        case 'mapping-entry':
          output = executeMappingEntryNode(childNode, childInput);
          break;
        case 'mapping-response':
          // Real request defaults, overridden only by whatever's actually
          // wired in — NOT executeMappingResponseNode, which mixes in
          // real-reply defaults that don't exist yet at this pause point.
          output = {
            method: childInput.method ?? input.method,
            url: childInput.url ?? input.url,
            headers: childInput.headers ?? input.headers,
            body: childInput.body ?? input.body,
          };
          break;
        case 'json-object':
          output = executeJsonObjectNode(childNode);
          break;
        case 'js-snippet': {
          const jsResult = executeJsSnippetNode(childNode, childInput);
          output = jsResult.output;
          consoleLogs = jsResult.consoleLogs.length > 0 ? jsResult.consoleLogs : undefined;
          break;
        }
        case 'request':
          output = await executeRequestNode(childNode, childInput, envVariables);
          break;
        case 'sleep':
          output = await executeSleepNode(childNode, childInput, callbacks, cancelledRef);
          break;
        case 'log': {
          const logResult = executeLogNode(childNode, childInput);
          output = logResult.output;
          consoleLogs = logResult.consoleLogs;
          break;
        }
        default:
          throw new Error(`Unsupported node type in mapping request segment: ${childNode.type}`);
      }
    } catch (err) {
      // Same reporting pattern as executeMappingNode — tag as reported so the
      // outer chain executor doesn't re-attribute the error to the container.
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onError(childNode.id, message);
      const reported = new Error(message);
      (reported as Error & { stitchErrorReported?: boolean }).stitchErrorReported = true;
      throw reported;
    }

    ctx.nodeOutputs[childNode.id] = output;
    callbacks.onNodeComplete(childNode.id, output, Date.now() - childStart, undefined, consoleLogs);
  }

  const responseOutput = (ctx.nodeOutputs[responseNode.id] ?? {}) as Record<string, unknown>;
  return {
    method: typeof responseOutput.method === 'string' ? responseOutput.method : input.method,
    url: typeof responseOutput.url === 'string' ? responseOutput.url : input.url,
    headers:
      responseOutput.headers && typeof responseOutput.headers === 'object' && !Array.isArray(responseOutput.headers)
        ? (responseOutput.headers as Record<string, string>)
        : input.headers,
    body: responseOutput.body !== undefined ? responseOutput.body : input.body,
  };
}
