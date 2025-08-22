/**
 * SSO Policy Preview widget.
 * Example: <PolicyPreviewWidget />
 */
'use client';

import { useState } from 'react';
import StatusBar from './DAMExplorer/StatusBar';

export default function PolicyPreviewWidget() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const evaluate = () => {
    if (!email) {
      setToast({ msg: 'Could not evaluate policy. Please try again.', type: 'error' });
      return;
    }
    setResult(email.endsWith('@example.com') ?
      'This email meets the tenant’s SSO policy.' :
      'This email is rejected by current SSO rules.'
    );
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">SSO Policy Preview</h3>
      <label className="block text-sm">
        Email Address
        <input
          placeholder="user@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border p-1 w-full"
        />
      </label>
      <button onClick={evaluate} className="px-2 py-1 border rounded">
        Evaluate
      </button>
      {result && <p className="text-sm">{result}</p>}
      <p className="text-xs text-muted">Enter an email to see if current SSO rules would allow sign-in or auto‑join.</p>
      <StatusBar
        message={toast?.msg}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
