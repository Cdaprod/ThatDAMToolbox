# Camera Monitor and Explorer – Mobile-First Specification

## Product Intent
The Camera Monitor and Explorer must be truly mobile-first, zero-surprise UIs that auto-fit to any device or orientation, keep critical controls within one viewport, and never force the user to pan or zoom just to operate the system.

Refer to [Camera Monitor TODO](../CAMERA-MONITOR-TODO.md) for complementary API route requirements.

## Core Principles
1. **One-screen operation:** all primary actions visible without scrolling in portrait and landscape.
2. **Fluid scaling over fixed breakpoints:** sizing adapts to device width, height, and user font settings.
3. **Orientation-aware:** layout reflows based on camera feed aspect ratio and device orientation.
4. **Non-intrusive chrome:** app bars and sidebars never load zoomed or clipped after rotation.
5. **Modals behave like apps:** headers stick, content scrolls, and context never jumps.
6. **Respect user settings:** honor system font scaling, prefers-reduced-motion, and safe-area insets.
7. **Guard against accidental browser behaviors:** pull-to-refresh only when deliberate.

## Camera Monitor Layout
- **Regions:** top action bar, input/codec strip, video viewport, control strip, optional diagnostics.
- **Portrait stacking:** input/codec strip → video viewport (dominant) → control strip.
- **Landscape stacking:** left video viewport (dominant) → right stacked controls.
- **Video viewport sizing:** letterbox within available area; never overflows; preserves aspect ratio; centers with pillar/letter bars when needed.
- **Input/codec strip:** compact, single row, wraps to two rows on narrow devices without pushing the viewport offscreen.
- **Control strip:** four clusters (record, monitor, display, audio) in a single row with equal-width buttons and icon+label; collapse labels to icons with tooltips when space constrained.
- **Diagnostics panel:** collapsible drawer; closed by default on phones; expansion uses overlay or slide-over so core controls stay visible.

### Acceptance Checks
- On an iPhone in portrait, all primary controls and the video are visible at once.
- On rotation, the viewport reflows without zooming or forcing reload.
- The video never distorts; black bars are acceptable; no scroll required to see any control.

## Responsiveness Rules
- Use fluid sizing with percentage, viewport, and clamp-style ramps for type and spacing.
- Minimum touch targets: 44×44 px; spacing scales with font size changes.
- Container-driven layout: the video container dictates control density, not global breakpoints alone.
- Respect browser zoom and OS font scaling; avoid hard caps that fight user settings.

## Orientation and Stream Awareness
- The player reads the incoming feed’s width/height and rotates UI affordances accordingly (e.g., aspect tag).
- If the feed changes orientation mid-session, the viewport re-fits without layout shift beyond the video box.

## Bars and Chrome Behavior
- Top bar and side drawer never cause the page to load zoomed.
- After rotation, bars remain pinned; content adjusts within the safe area; no scroll jump to the top.
- Account for dynamic browser UI (e.g., iOS Safari) so content never hides under OS chrome.

## Explorer Modal and Page Behavior
- Modal header is sticky; only the asset list grid/column scrolls.
- Modal width/height fit within the viewport in both orientations; never exceeds screen or triggers pinch-zoom.
- Rotation while open recalculates the modal frame and keeps it centered and usable.
- Asset grid/list view toggles remain visible; long folder names truncate gracefully.
- Nested panels (filters, details) confine scroll to the inner panel; the modal shell stays fixed.

### Acceptance Checks
- Opening Explorer on a phone shows full header + search + at least one full asset row without scrolling.
- Rotating with Explorer open does not force closing/reopening; nothing zooms in.
- The asset container scrolls; the modal header never scrolls out of view.

## Scroll and Pull-to-Refresh Policy
- Vertical pull-to-refresh recognized only when the gesture starts in the top app bar region.
- Gestures starting in the video, control strip, or modal content are captured by the app and never bubble to browser refresh.
- Horizontal swipes inside carousels or grids never trigger browser navigation.

## Accessibility and Motion
- All controls have accessible names and states (e.g., Record: armed/recording).
- Focus order is logical top-to-bottom, left-to-right; focus is trapped within modals.
- Reduced-motion preference disables nonessential transitions; essential ones are shortened.
- Color contrast meets WCAG AA for text and icons against the brand palette.

## Performance Expectations
- First contentful paint under 2s on mid-range mobile over LAN.
- No layout thrash on rotation; reflow is a single measurement pass.
- Video viewport renders via GPU-friendly transforms; no re-rasterizing per frame.
- Modal open/close allocates once; lists virtualize after N items.

## Telemetry and QA Hooks
- Log orientation changes, viewport size, and whether reflow completed in a single pass.
- Emit modal open/close, rotation-while-open, and any scroll-beyond-bounds suppression events.
- Record “controls below fold” incidents; target zero in production for phone classes.

## Test Matrix (Minimum)
**Devices:** small iPhone portrait/landscape, large Android portrait/landscape, iPad/tablet both, laptop Chrome and Safari.
**States:** fresh load, after rotation, after font size increase, after browser zoom to 110–125%, with Explorer open, with Diagnostics open.
**Streams:** 16:9, 9:16, 1:1; switch orientation mid-session.

## Task Stubs
1. Define a canonical layout contract for the Monitor page with named regions and a single source of truth for available “video box” dimensions.
2. Implement a fluid sizing map for typography and spacing that respects system font scaling and browser zoom.
3. Add an orientation and aspect observer that updates layout state without causing a re-mount.
4. Refactor control groups (record, monitor, display, audio) into a density-aware bar that collapses labels before wrapping.
5. Pin app bars and sidebars with safe-area awareness; eliminate zoomed-on-load after rotation through correct viewport handling.
6. Create a modal shell with a sticky header and isolated scroll area; adopt it for Explorer and any other full-height modals.
7. Add rotation persistence for modals: recompute max size on resize/orientation events while keeping internal scroll position stable.
8. Gate browser pull-to-refresh and back/forward gestures: only allow refresh on intentional top-bar pull; prevent elsewhere.
9. Ensure the Monitor page never requires vertical scroll in portrait on phone class devices; if space is insufficient, reduce density and prioritize primary controls.
10. Add diagnostics drawer that overlays rather than reflows; ensure it never pushes core controls offscreen on mobile.
11. Introduce acceptance tests for the test matrix above, including visual snapshots before/after rotation and with modal open.
12. Wire telemetry for layout pass count, rotation reflow time, modal rotation behavior, and “controls below fold” incidents.
13. Conduct accessibility pass: names, roles, states, focus management, contrast; verify with mobile screen readers.
14. Optimize frame pipeline for the video viewport to ensure GPU-accelerated scaling and minimal CPU churn.
15. Create a fallback density scale for “worst case” developer mode that force-shrinks nonessential UI by a small, consistent factor without altering user font settings.

## Non-Goals
- No forced fixed font sizes; user accessibility settings must prevail.
- No hidden controls behind additional taps for the primary actions; collapsing is allowed but they remain visible.
- No page-level scroll traps; only modals and inner panes may trap scroll.

## Definition of Done
- On phone in portrait, the Monitor page shows input/codec strip, the video viewport, and the entire control strip at once with no scroll or zoom gymnastics.
- Explorer modal is usable end-to-end in both orientations, including rotation while open, with header fixed and content scrolling.
- Pull-to-refresh occurs only from the top bar region; accidental refresh from the content area is not possible.
- Rotation never requires closing modals or reloading; layout reflows are smooth and single-pass.
- Accessibility and performance targets above are met; telemetry shows zero “controls below fold” events in the test matrix.

