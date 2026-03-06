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
    startTime.current = Date.now();
    const calculate = () => {
      const now = Date.now();
      const elapsedTime = now - startTime.current;
      const delta = elapsedTime / 1000 * (speed ?? 0);
      currentVal.current = value + delta;

      if (ref.current) {
        ref.current.textContent = formatValue(currentVal.current);
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
