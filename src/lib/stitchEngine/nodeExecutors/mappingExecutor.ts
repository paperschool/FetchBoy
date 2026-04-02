import type { StitchNode, StitchConnection, ExecutionCallbacks, MappingExitNodeConfig } from '@/types/stitch';
import { topologicalSort } from '../topologicalSort';
import { resolveNodeInputs } from '../inputResolution';
import { createExecutionContext } from '../chainExecutor';
import { executeJsonObjectNode } from './jsonObjectExecutor';
import { executeJsSnippetNode } from './jsSnippetExecutor';
import { executeRequestNode } from './requestExecutor';
import { executeSleepNode } from './sleepExecutor';

export function executeMappingEntryNode(
  _node: StitchNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
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
    status: input.status ?? 200,
    headers: input.headers ?? {},
    body: input.body ?? {},
    cookies,
  };
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
      if (h.key) headers[h.key] = h.value;
    }
  }

  if (input.cookies && typeof input.cookies === 'object' && !Array.isArray(input.cookies)) {
    const cookieEntries = Object.entries(input.cookies as Record<string, string>);
    if (cookieEntries.length > 0) {
      headers['Set-Cookie'] = cookieEntries.map(([k, v]) => `${k}=${v}`).join(', ');
    }
  } else {
    const setCookies: string[] = [];
    for (const c of config.cookies ?? []) {
      if (c.key) setCookies.push(`${c.key}=${c.value}`);
    }
    if (setCookies.length > 0) {
      headers['Set-Cookie'] = setCookies.join(', ');
    }
  }

  let body: unknown = input.body ?? config.body ?? '';
  if (typeof body === 'object' && body !== null) body = JSON.stringify(body);

  return {
    status,
    headers,
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
): Promise<Record<string, unknown>> {
  const childNodes = allNodes.filter((n) => n.parentNodeId === mappingNode.id);
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

  const ctx = createExecutionContext();

  for (const childNode of sortedChildren) {
    if (cancelledRef.current) break;

    callbacks.onNodeStart(childNode.id);
    const childStart = Date.now();

    const childInput = resolveNodeInputs(childNode.id, childConnections, ctx);

    if (childNode.type === 'mapping-entry') {
      Object.assign(childInput, input);
    }

    let output: unknown;
    let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;

    switch (childNode.type) {
      case 'mapping-entry':
        output = executeMappingEntryNode(childNode, childInput);
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
      default:
        throw new Error(`Unsupported node type in mapping: ${childNode.type}`);
    }

    ctx.nodeOutputs[childNode.id] = output;
    callbacks.onNodeComplete(childNode.id, output, Date.now() - childStart, undefined, consoleLogs);
  }

  return (ctx.nodeOutputs[exitNodeId] ?? {}) as Record<string, unknown>;
}
