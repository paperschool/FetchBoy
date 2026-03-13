import { useRef, useState, useCallback } from 'react'

export function useSplitPane(defaultTopPercent = 60, minPx = 120) {
  const [topPercent, setTopPercent] = useState(defaultTopPercent)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const containerH = containerRef.current?.getBoundingClientRect().height ?? 0

    const onMove = (moveE: MouseEvent) => {
      const delta = moveE.clientY - startY
      const newTopPx = (topPercent / 100) * containerH + delta
      const clamped = Math.min(containerH - minPx, Math.max(minPx, newTopPx))
      setTopPercent((clamped / containerH) * 100)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [topPercent, minPx])

  return { containerRef, topPercent, onDividerMouseDown: onMouseDown }
}
