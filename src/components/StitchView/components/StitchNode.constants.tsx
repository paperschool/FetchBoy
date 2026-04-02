import { Send, Code, Braces, Timer, Repeat, GitMerge, GitBranch, Globe, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { StitchNodeType as NodeType } from '@/types/stitch';

export const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-600 text-white',
  POST: 'bg-blue-600 text-white',
  PUT: 'bg-orange-500 text-white',
  PATCH: 'bg-yellow-600 text-white',
  DELETE: 'bg-red-600 text-white',
  HEAD: 'bg-gray-500 text-white',
  OPTIONS: 'bg-gray-500 text-white',
};

export const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  'request': <Send size={12} />,
  'js-snippet': <Code size={12} />,
  'json-object': <Braces size={12} />,
  'sleep': <Timer size={12} />,
  'loop': <Repeat size={12} />,
  'merge': <GitMerge size={12} />,
  'condition': <GitBranch size={12} />,
  'mapping': <Globe size={12} />,
  'mapping-entry': <ArrowDownToLine size={12} />,
  'mapping-exit': <ArrowUpFromLine size={12} />,
};

export const NODE_COLORS: Record<NodeType, string> = {
  'request': 'bg-app-main/95 border-blue-500/40',
  'js-snippet': 'bg-app-main/95 border-amber-500/40',
  'json-object': 'bg-app-main/95 border-green-500/40',
  'sleep': 'bg-app-main/95 border-purple-500/40',
  'loop': 'bg-app-main/95 border-cyan-500/40',
  'merge': 'bg-app-main/95 border-indigo-500/40',
  'condition': 'bg-app-main/95 border-orange-500/40',
  'mapping': 'bg-app-main/95 border-yellow-500/40',
  'mapping-entry': 'bg-app-main/95 border-yellow-500/40',
  'mapping-exit': 'bg-app-main/95 border-yellow-500/40',
};

export const NODE_HEADER_COLORS: Record<NodeType, string> = {
  'request': 'bg-blue-500/15',
  'js-snippet': 'bg-amber-500/15',
  'json-object': 'bg-green-500/15',
  'sleep': 'bg-purple-500/15',
  'loop': 'bg-cyan-500/15',
  'merge': 'bg-indigo-500/15',
  'condition': 'bg-orange-500/15',
  'mapping': 'bg-yellow-500/15',
  'mapping-entry': 'bg-yellow-500/15',
  'mapping-exit': 'bg-yellow-500/15',
};

export const NODE_WIDTH = 180;
