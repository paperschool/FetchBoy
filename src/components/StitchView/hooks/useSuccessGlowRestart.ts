import { useLayoutEffect, type RefObject } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { ExecutionNodeStatus } from '@/types/stitch';

/**
 * Forces a one-shot `forwards`-filled CSS animation to restart by removing
 * the class, forcing a reflow, then re-adding it — re-adding the identical
 * className within the same paint (as happens on fast re-runs, since
 * `executionNodeOutputs` now persists instead of being cleared between runs)
 * otherwise won't restart the animation in the browser.
 */
export function useAnimationRestart(
    ref: RefObject<Element | null>,
    active: boolean,
    className: string,
): void {
    const executionStartTime = useStitchStore((s) => s.executionStartTime);

    useLayoutEffect(() => {
        if (!active || !ref.current) return;
        const el = ref.current;
        el.classList.remove(className);
        void el.getBoundingClientRect();
        el.classList.add(className);
    }, [active, className, executionStartTime, ref]);
}

/** `.stitch-node-success` is the one-shot glow animation on execution nodes. */
export function useSuccessGlowRestart(
    ref: RefObject<HTMLElement | null>,
    executionStatus: ExecutionNodeStatus | null | undefined,
): void {
    useAnimationRestart(ref, executionStatus === 'success', 'stitch-node-success');
}

