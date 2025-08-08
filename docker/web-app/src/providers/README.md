Absolutely--here’s a polished, production-style README.md for your provider stack, with best practices, quick explanation, and an updated diagram.

⸻


# Provider Stack: Global Context Hierarchy

This app uses a *modular* provider stack to manage state, server data, sockets, and UI context across all features.  
Providers are layered top-to-bottom, so each child gets access to every parent context.

## Overview

``` 
QueryClientProvider      # TanStack React Query (caching & API state)
└─ ThemeProvider?        # (Optional) dark/light theme system
└─ VideoSocketProvider
└─ AssetProvider   # Handles asset lists, details, real-time asset events
└─ CaptureProvider?    # (Optional) Global recording controls
└─ ModalProvider    # Centralized modal dialog context
└─ children      # TopBar, MainLayout, all page components
``` 

- **QueryClientProvider**  
  Wraps the entire app with TanStack Query; all API calls, caching, and re-fetching go through here.

- **ThemeProvider** *(optional)*  
  Provides dark/light mode and theme switching for the app UI.  
  Skip this if your theme is static or handled via Tailwind only.

- **VideoSocketProvider**  
  Manages global video websocket (live event stream, camera commands, asset sync).

- **AssetProvider**  
  Fetches and syncs all asset/folder data, and exposes helper hooks like `useAssets`, `useFolders`.

- **CaptureProvider** *(optional, code-split)*  
  Globally exposes `useCapture()`--start/stop video recording and listen for state changes.  
  Dynamically loaded, so it only impacts the bundle for pages that actually use recording features.

- **ModalProvider**  
  Enables any component to show modals/dialogs without prop drilling.  
  Use the `useModal` hook to open/close dialogs anywhere in the component tree.

- **children**  
  All your main components, including navigation, dashboard pages, cards, and modals.

---

## How to Add or Remove Providers

- **Add a new provider**:  
  1. Create it in `/providers/YourProvider.tsx`
  2. Wrap it around `children` in `/providers/AppProviders.tsx` in the correct order.

- **Remove a provider**:  
  Just delete its import and remove its wrapper from the stack in `AppProviders.tsx`.

---

## Example: AppProviders.tsx

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import ThemeProvider           from './ThemeProvider';       // optional
import VideoSocketProvider     from './VideoSocketProvider';
import AssetProvider           from './AssetProvider';
import CaptureProvider         from './CaptureProvider';     // optional, dynamic import
import ModalProvider           from './ModalProvider';

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider> {/* remove if not used */}
        <VideoSocketProvider>
          <AssetProvider>
            <CaptureProvider>
              <ModalProvider>
                {children}
              </ModalProvider>
            </CaptureProvider>
          </AssetProvider>
        </VideoSocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
``` 

⸻

	•	Order matters:
Each provider can depend on the ones above it.
E.g. CaptureProvider expects the socket and assets to be available.
	•	Dynamic imports:
Providers that are large or only needed on some routes (like recording/capture) can be loaded with next/dynamic for better performance.

⸻

Why Use a Provider Stack?
	•	No prop drilling--just call your custom hooks anywhere in the tree.
	•	Consistent global state--UI, data, sockets, and modals all behave the same everywhere.
	•	Easy to add new global context--add a new provider and hook, no refactors needed.

---

Let me know if you want a more "enterprise-y" version, or one that’s more step-by-step for contributors!

## Asset action registries

Tools expose the verbs they support via a `useAssetActions` hook:

```
import { useAssetActions } from '@/tools/dam-explorer/actions'
const actions = useAssetActions(asset)
```

`SelectableItem` consumes these actions and the global `ActionSheet`
renders them on long‑press. This keeps per‑tool logic isolated while
sharing a consistent interaction model.