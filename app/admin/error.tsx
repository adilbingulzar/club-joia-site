'use client';
// The dashboard when the backend can't be reached or answers wrong.
import Link from 'next/link';

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="adm-login">
      <div className="adm-card" style={{ maxWidth: 440, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 8 }}>Sales data can’t be loaded</h1>
        <p className="adm-muted" style={{ margin: '0 0 18px' }}>The ticket backend didn’t answer. Please try again in a moment.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="adm-btn primary" type="button" onClick={reset}>Try again</button>
          <Link className="adm-btn" href="/admin/login">Sign in again</Link>
        </div>
      </div>
    </main>
  );
}
