"use client";
import { useEffect, useRef } from "react";

interface CounterProps {
  value: number;
  speed?: number;
}

export function Counter({ value, speed }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const currentVal = useRef(value);
  const startTime = useRef(Date.now());
  const animationRef = useRef<number>();

  const formatValue = (val: number) => val.toFixed(2);

  useEffect(() => {
    // No animation needed for stationary flights — avoids a running rAF loop
    // that would burn CPU/battery while rendering the same value every frame.
    if (!speed) return;

    startTime.current = Date.now();
    let lastFrameTime = 0;
    // Cap to ~10fps — each flight card runs its own rAF loop, so 60fps per card
    // drains battery noticeably on mobile when several flights are visible.
    const calculate = (timestamp: number) => {
      if (timestamp - lastFrameTime >= 100) {
        lastFrameTime = timestamp;
        const elapsed = (Date.now() - startTime.current) / 1000;
        currentVal.current = value + elapsed * speed;
        if (ref.current) {
          ref.current.textContent = formatValue(currentVal.current);
        }
      }
      animationRef.current = requestAnimationFrame(calculate);
    };
    animationRef.current = requestAnimationFrame(calculate);
    return () => cancelAnimationFrame(animationRef.current!);
  }, [value, speed]);

  return (
    <span ref={ref} className="tabular-nums">{formatValue(currentVal.current)}</span>
  )
}
