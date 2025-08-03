// /src/hooks/useTimecode.ts
import { useState, useEffect, useCallback } from 'react';

export function useTimecode(initial = {h:0,m:0,s:0,f:0}) {
  const [tc, setTc] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => {
      setTc(prev => {
        let {h,m,s,f} = prev;
        f++;
        if (f >= 30) { f=0; s++; }
        if (s >= 60) { s=0; m++; }
        if (m >= 60) { m=0; h++; }
        return {h,m,s,f};
      });
    }, 33);
    return () => clearInterval(id);
  }, []);
  const format = useCallback(() => {
    const z = (n:number) => n.toString().padStart(2,'0');
    return `${z(tc.h)}:${z(tc.m)}:${z(tc.s)}:${z(tc.f)}`;
  }, [tc]);
  return { tc, format };
}