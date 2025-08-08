## Dashboard Modules

The dashboard auto-discovers its tools from `components/dashboardTools.ts` and
groups them using the `useIntelligentLayout` hook (`src/hooks/useIntelligentLayout.ts`).
Tools are rendered in primary/secondary/tertiary sections based on activity and recency.

| Route                           | Purpose            |
|---------------------------------|--------------------|
| /dashboard/camera-monitor       | Camera Monitor     |
| /dashboard/dam-explorer         | DAM Explorer       |
| /dashboard/explorer             | File Explorer      |
| /dashboard/motion               | Motion Tool        |
| /dashboard/live                 | Live Monitor       |
| /dashboard/witness              | Witness Tool       |