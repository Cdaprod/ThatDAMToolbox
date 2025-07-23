// docker/web-app/app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const client = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools position="bottom-right" initialIsOpen={false} />
    </QueryClientProvider>
  );
}