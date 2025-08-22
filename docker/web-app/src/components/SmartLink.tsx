'use client'
import NextLink, { LinkProps as NextLinkProps } from 'next/link'
import { ComponentProps } from 'react'

type Props = NextLinkProps & ComponentProps<'a'> & { prefetch?: boolean }
export default function SmartLink({ prefetch = false, ...props }: Props) {
  return <NextLink prefetch={prefetch} {...props} />
}

