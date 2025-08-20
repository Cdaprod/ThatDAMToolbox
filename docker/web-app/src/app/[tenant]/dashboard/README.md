## Dashboard Modules

The dashboard auto-discovers its tools from `components/dashboardTools.ts` and
groups them using the `useIntelligentLayout` hook (`src/hooks/useIntelligentLayout.ts`).
Tools are rendered in primary/secondary/tertiary sections based on activity and recency.

| Route                           | Purpose            |
|---------------------------------|--------------------|
| /{tenant}/dashboard/camera-monitor       | Camera Monitor     |
| /{tenant}/dashboard/dam-explorer         | DAM Explorer       |
| /{tenant}/dashboard/motion               | Motion Tool        |
| /{tenant}/dashboard/live                 | Live Monitor       |
| /{tenant}/dashboard/witness              | Witness Tool       |

