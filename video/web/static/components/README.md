# JS Components

Reusable ES modules used by the web UI.  Import them from `app.js` or other scripts:

- `batch-card.js` – render ingest batches
- `upload-card.js` – manage file uploads
- `ffmpeg-console.js` – interact with ffmpeg endpoint
- `dam-explorer.js` – browse DAM search results

```javascript
import { UploadCard } from './components/upload-card.js'
```

### ffmpeg-console.js

Include the FFmpeg card partial and this script; it auto-initializes on load:

```html
<!-- see templates/partials/_ffmpeg_card.html for markup -->
<script type="module" src="/static/components/ffmpeg-console.js"></script>
```

