'use client'
import NextLink, { LinkProps } from 'next/link.js'
import { ComponentProps } from 'react'
type Props = LinkProps & ComponentProps<'a'> & { prefetch?: boolean }
export default function SmartLink({ prefetch = false, ...props }: Props) {
  return <NextLink prefetch={prefetch} {...props} />
}
