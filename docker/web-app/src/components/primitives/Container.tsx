'use client';
import clsx from 'clsx';

 type Props = React.PropsWithChildren<{
   max?: 'xs'|'sm'|'md'|'lg'|'xl'|'none';
   as?: React.ElementType;
   className?: string;
 }>;

 export default function Container({
   children,
   max='lg',
   as:Tag='div',
   className,
 }:Props){
   return (
     <Tag
       className={clsx(
         'container-fluid',
         max!=='none' && `max-w-${max}`,
         className
       )}
     >
       {children}
     </Tag>
   );
 }
