/**
 * Task stubs for the Camera Monitor and Explorer mobile-first specification.
 * Each function represents an implementation task from
 * docs/TECHNICAL/CAMERA_MONITOR_EXPLORER_SPEC.md.
 *
 * Usage: import individual functions or iterate over `uiUxTasks` to
 * drive future implementation work. Tasks are grouped into global,
 * monitor, and explorer categories to emphasize scope.
 */

/** Global UI/UX tasks derived from core principles. */
export const globalTasks = {
  /** Ensure primary actions remain visible without scrolling across the app. */
  ensureOneScreenOperation(): never {
    throw new Error('Not implemented: ensureOneScreenOperation');
  },

  /** Implement a fluid sizing map that responds to font scaling and zoom. */
  implementFluidSizingMap(): never {
    throw new Error('Not implemented: implementFluidSizingMap');
  },


  /** Keep app chrome within safe areas and avoid zoom-on-load. */
  pinChromeWithSafeArea(): never {
    throw new Error('Not implemented: pinChromeWithSafeArea');
  },

  /** Treat modals as full apps with sticky headers and stable context. */
  ensureModalsBehaveLikeApps(): never {
    throw new Error('Not implemented: ensureModalsBehaveLikeApps');
  },

  /** Honor system font scaling, reduced motion, and safe-area insets. */
  honorUserSettings(): never {
    throw new Error('Not implemented: honorUserSettings');
  },

  /** Prevent accidental browser gestures like pull-to-refresh. */
  gateBrowserGestures(): never {
    throw new Error('Not implemented: gateBrowserGestures');
  },

  /** Add acceptance tests covering rotation, zoom, and modal states. */
  introduceAcceptanceTests(): never {
    throw new Error('Not implemented: introduceAcceptanceTests');
  },

  /** Wire telemetry for layout passes, rotations, and below-fold controls. */
  wireLayoutTelemetry(): never {
    throw new Error('Not implemented: wireLayoutTelemetry');
  },

  /** Conduct an accessibility pass for names, roles, and contrast. */
  conductAccessibilityPass(): never {
    throw new Error('Not implemented: conductAccessibilityPass');
  },

  /** Provide a fallback density scale for developer mode without font hacks. */
  createFallbackDensityScale(): never {
    throw new Error('Not implemented: createFallbackDensityScale');
  },
} as const;

/** Camera Monitor specific tasks. */
export const monitorTasks = {
  /** Define Monitor layout regions and video box sizing contract. */
  defineMonitorLayoutContract(): never {
    throw new Error('Not implemented: defineMonitorLayoutContract');
  },

  /** Refactor record/monitor/display/audio controls into a responsive bar. */
  refactorControlGroups(): never {
    throw new Error('Not implemented: refactorControlGroups');
  },

  /** Ensure Monitor never scrolls vertically on phone portrait. */
  enforceNoScrollMonitor(): never {
    throw new Error('Not implemented: enforceNoScrollMonitor');
  },

  /** Overlay diagnostics drawer without pushing controls offscreen. */
  addDiagnosticsDrawer(): never {
    throw new Error('Not implemented: addDiagnosticsDrawer');
  },

  /** Optimize video frame pipeline for GPU scaling and low CPU churn. */
  optimizeVideoFramePipeline(): never {
    throw new Error('Not implemented: optimizeVideoFramePipeline');
  },
} as const;

/** Explorer modal related tasks. */
export const explorerTasks = {
  /** Modal shell with sticky header and isolated scroll area. */
  createStickyModalShell(): never {
    throw new Error('Not implemented: createStickyModalShell');
  },

  /** Preserve modal state on rotation while keeping scroll position. */
  addModalRotationPersistence(): never {
    throw new Error('Not implemented: addModalRotationPersistence');
  },
} as const;

/** Combined map of all UI/UX tasks for easy iteration. */
export const uiUxTasks = {
  ...globalTasks,
  ...monitorTasks,
  ...explorerTasks,
} as const;

export type UiUxTaskName = keyof typeof uiUxTasks;

export const taskNames = Object.keys(uiUxTasks) as UiUxTaskName[];

export const {
  ensureOneScreenOperation,
  implementFluidSizingMap,
  pinChromeWithSafeArea,
  ensureModalsBehaveLikeApps,
  honorUserSettings,
  gateBrowserGestures,
  introduceAcceptanceTests,
  wireLayoutTelemetry,
  conductAccessibilityPass,
  createFallbackDensityScale,
  defineMonitorLayoutContract,
  refactorControlGroups,
  enforceNoScrollMonitor,
  addDiagnosticsDrawer,
  optimizeVideoFramePipeline,
  createStickyModalShell,
  addModalRotationPersistence,
} = uiUxTasks;

