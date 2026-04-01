// ─── Stitch Node Types ──────────────────────────────────────────────────────

export type StitchNodeType = 'request' | 'json-object' | 'js-snippet' | 'sleep' | 'loop' | 'merge' | 'condition' | 'mapping' | 'mapping-entry' | 'mapping-exit';

export type StitchExecutionState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// ─── Node Config Shapes ─────────────────────────────────────────────────────

export interface JsonObjectNodeConfig {
  json: string;
}

export const DEFAULT_JSON_OBJECT_CONFIG: JsonObjectNodeConfig = {
  json: '{\n  "key": "value"\n}',
};

export interface JsSnippetNodeConfig {
  code: string;
  isLoopEntry?: boolean;
}

export const DEFAULT_JS_SNIPPET_CONFIG: JsSnippetNodeConfig = {
  code: '// Transform input data\n// Return an object — its keys become output ports\nreturn {\n  result: input.key\n};\n',
};

export interface StitchKeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export type StitchAuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key'; key: string; value: string; in: 'header' | 'query' };

export interface RequestNodeConfig {
  method: string;
  url: string;
  headers: StitchKeyValuePair[];
  queryParams: StitchKeyValuePair[];
  body: string;
  bodyType: 'none' | 'json' | 'text' | 'xml';
  auth?: StitchAuthConfig;
}

export const DEFAULT_REQUEST_NODE_CONFIG: RequestNodeConfig = {
  method: 'GET',
  url: '',
  headers: [],
  queryParams: [],
  body: '',
  bodyType: 'none',
  auth: { type: 'none' },
};

export const REQUEST_OUTPUT_PORTS = ['status', 'headers', 'body'] as const;

export interface SleepNodeConfig {
  mode: 'fixed' | 'random';
  durationMs: number;
  minMs: number;
  maxMs: number;
}

export const DEFAULT_SLEEP_NODE_CONFIG: SleepNodeConfig = {
  mode: 'fixed',
  durationMs: 1000,
  minMs: 500,
  maxMs: 2000,
};

export interface LoopNodeConfig {
  delayMs: number;
}

export const DEFAULT_LOOP_NODE_CONFIG: LoopNodeConfig = {
  delayMs: 100,
};

export interface MergeNodeConfig {
  keyMode: 'label' | 'id';
}

export const DEFAULT_MERGE_NODE_CONFIG: MergeNodeConfig = {
  keyMode: 'label',
};

export interface ConditionNodeConfig {
  expression: string;
}

export const DEFAULT_CONDITION_NODE_CONFIG: ConditionNodeConfig = {
  expression: 'input.status === 200',
};

export interface MappingNodeConfig {
  urlPattern: string;
  matchType: 'exact' | 'partial' | 'wildcard' | 'regex';
}

export const DEFAULT_MAPPING_CONFIG: MappingNodeConfig = {
  urlPattern: '',
  matchType: 'partial',
};

export interface MappingEntryNodeConfig {
  isEntryNode: true;
}

export const DEFAULT_MAPPING_ENTRY_CONFIG: MappingEntryNodeConfig = {
  isEntryNode: true,
};

export interface MappingExitNodeConfig {
  isExitNode: true;
  status: number;
  headers: Array<{ key: string; value: string }>;
  cookies: Array<{ key: string; value: string }>;
  body: string;
  bodyContentType: string;
}

export const DEFAULT_MAPPING_EXIT_CONFIG: MappingExitNodeConfig = {
  isExitNode: true,
  status: 200,
  headers: [],
  cookies: [],
  body: '',
  bodyContentType: 'application/json',
};

// ─── Domain Interfaces ──────────────────────────────────────────────────────

export interface StitchChain {
  id: string;
  name: string;
  mappingId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StitchNode {
  id: string;
  chainId: string;
  type: StitchNodeType;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  label: string | null;
  parentNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StitchConnection {
  id: string;
  chainId: string;
  sourceNodeId: string;
  sourceKey: string | null;
  targetNodeId: string;
  targetSlot: string | null;
  createdAt: string;
}

// ─── Raw DB Row Interfaces ──────────────────────────────────────────────────

export interface RawStitchChain {
  id: string;
  name: string;
  mapping_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawStitchNode {
  id: string;
  chain_id: string;
  type: string;
  position_x: number;
  position_y: number;
  config: string;
  label: string | null;
  parent_node_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Execution Types ────────────────────────────────────────────────────────

export type ExecutionNodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface ExecutionLogEntry {
  nodeId: string;
  nodeLabel: string;
  nodeType: StitchNodeType;
  status: 'started' | 'completed' | 'error' | 'sleeping' | 'cancelled' | 'skipped';
  timestamp: number;       // ms since execution start
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  url?: string;            // request node URL (after interpolation)
  loopIteration?: number;  // set for child steps inside a loop
  loopNodeId?: string;     // the parent loop node ID
  consoleLogs?: Array<{ level: 'log' | 'warn' | 'error'; args: string }>;
  parallel?: boolean;
  conditionResult?: boolean;
}

export interface ExecutionContext {
  nodeOutputs: Record<string, unknown>;
  logs: ExecutionLogEntry[];
  status: 'running' | 'completed' | 'error' | 'cancelled';
  currentNodeId: string | null;
  error: { nodeId: string; message: string } | null;
  startTime: number;
}

export interface LoopStepContext {
  loopNodeId: string;
  iteration: number;
}

export interface ExecutionCallbacks {
  onNodeStart: (nodeId: string, loopCtx?: LoopStepContext) => void;
  onNodeComplete: (nodeId: string, output: unknown, durationMs: number, loopCtx?: LoopStepContext, consoleLogs?: Array<{ level: 'log' | 'warn' | 'error'; args: string }>) => void;
  onError: (nodeId: string, error: string) => void;
  onSleepStart: (nodeId: string, durationMs: number) => void;
  onChainComplete: () => void;
}

// ─── Raw DB Row Interfaces ──────────────────────────────────────────────────

export interface RawStitchConnection {
  id: string;
  chain_id: string;
  source_node_id: string;
  source_key: string | null;
  target_node_id: string;
  target_slot: string | null;
  created_at: string;
}
