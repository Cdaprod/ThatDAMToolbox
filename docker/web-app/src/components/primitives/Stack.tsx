// /docker/web-app/src/components/primitives/Stack.tsx
'use client';
import clsx from 'clsx';

export default function Stack({
  gap='md',
  className,
  children,
}:{
  gap?:'xs'|'sm'|'md'|'lg';
  className?:string;
  children:React.ReactNode;
}){
  return (
    <div
      className={clsx(
        'flex flex-col',
        `gap-gutter-${gap}`,
        className
      )}
    >
      {children}
    </div>
  );
}
