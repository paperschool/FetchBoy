import { REQUEST_OUTPUT_PORTS } from '@/types/stitch';

/** Returns the static output ports for a Request node. */
export function getRequestOutputPorts(): string[] {
  return [...REQUEST_OUTPUT_PORTS];
}
