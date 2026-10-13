import { useEffect, useMemo, useState } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { RequestDetailView } from '@/components/InterceptView/RequestDetailView';
import { formatNodeOutput } from '../utils/formatNodeOutput';
import { adaptNodeOutputToInterceptRequest } from '../utils/nodeOutputToInterceptRequest';
import type { StitchNode } from '@/types/stitch';

type OutputTab = 'request' | 'response' | 'raw_response';

const BASE_TABS = [
  { id: 'response', label: 'Response' },
  { id: 'raw_response', label: 'Raw Response' },
];

/**
 * Shows a node's last-run output, reusing RequestDetailView instead of a
 * second body/headers/params renderer. Entry/Response/Exit and other node
 * types have no config to edit — this is what they show instead.
 *
 * Response is where the (possibly wired-modified) call is actually fired —
 * its request-firing shape (method/url/headers/body) is recorded separately
 * from its reply shape (status/headers/cookies/body), so it gets an extra
 * "Request" tab so both remain inspectable (see executionRequestNodeOutputs
 * field doc in stitchStore.ts).
 */
export function NodeOutputView({ node }: { node: StitchNode }): React.ReactElement {
  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);
  const executionRequestNodeOutputs = useStitchStore((s) => s.executionRequestNodeOutputs);
  const executionLogs = useStitchStore((s) => s.executionLogs);
  const [activeTab, setActiveTab] = useState<OutputTab>('response');

  const output = executionNodeOutputs[node.id];
  const hasOutput = node.id in executionNodeOutputs;
  const requestOutput = executionRequestNodeOutputs[node.id];
  const hasRequestOutput = node.type === 'mapping-response' && node.id in executionRequestNodeOutputs;
  const hasAnyOutput = hasOutput || hasRequestOutput;

  const lastLog = [...executionLogs].reverse().find(
    (e) => e.nodeId === node.id && (e.status === 'completed' || e.status === 'replayed'),
  );

  const tabs = hasRequestOutput ? [{ id: 'request', label: 'Request' }, ...BASE_TABS] : BASE_TABS;

  // Default to whichever tab actually has data — e.g. a request-only pause
  // has nothing under "Response" yet, so land on "Request" instead. Only
  // runs when the node changes, not on every data update, so it doesn't
  // yank focus away from a tab the user is actively looking at.
  useEffect(() => {
    if (hasRequestOutput) setActiveTab('request');
    else if (hasOutput) setActiveTab('response');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const adaptedRequest = useMemo(() => {
    if (!hasOutput) return null;
    return adaptNodeOutputToInterceptRequest(node, output, lastLog?.timestamp ?? Date.now());
  }, [node, hasOutput, output, lastLog]);

  const adaptedRequestPhase = useMemo(() => {
    if (!hasRequestOutput) return null;
    return adaptNodeOutputToInterceptRequest(node, requestOutput, lastLog?.timestamp ?? Date.now());
  }, [node, hasRequestOutput, requestOutput, lastLog]);

  // Self-contained flex/height context (matches JsonObjectEditor et al.)
  // rather than relying on `flex-1` alone, which only takes effect when the
  // caller's immediate parent already happens to be a flex container — not
  // true for every place this is rendered (e.g. NodeEditorBody's wrapper),
  // and without it Monaco collapses to a sliver since ViewerShell's height
  // never resolves to anything but auto/content-size.
  if (!hasAnyOutput) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden">
        <p className="text-sm text-app-muted">No results yet — run the chain to see output</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ViewerShell tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as OutputTab)} testId="node-output-view">
        {activeTab === 'request' && (
          adaptedRequestPhase ? (
            <RequestDetailView selectedRequest={adaptedRequestPhase} hideActions />
          ) : (
            <p className="text-sm text-app-muted p-3">No request-firing run recorded yet for this node.</p>
          )
        )}
        {activeTab === 'response' && (
          adaptedRequest ? (
            <RequestDetailView selectedRequest={adaptedRequest} hideActions />
          ) : (
            <p className="text-sm text-app-muted p-3">No response-shaping run recorded yet for this node.</p>
          )
        )}
        {activeTab === 'raw_response' && (
          <MonacoEditorField
            value={formatNodeOutput(hasOutput ? output : requestOutput)}
            language="json"
            readOnly={true}
            fontSize={12}
            path={`node-output-${node.id}`}
            testId="node-output-monaco"
            height="100%"
          />
        )}
      </ViewerShell>
    </div>
  );
}
