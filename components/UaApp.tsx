'use client';

import { useCallback, useEffect, useState } from 'react';

type Part = { name?: string; version?: string; major?: string };
type Parsed = {
  ua: string;
  browser: Part;
  engine: Part;
  os: Part;
  device: { vendor?: string; model?: string; type?: string };
  isMobile: boolean;
  isBot: boolean;
  deviceType: string;
  clientType: string;
  versionCheck?: { browserFamily: string; latestVersion: string; majorsBehind: number; isOutdated: boolean; osEndOfLife: boolean } | null;
  summary?: string | null; // paid plans
  isSuspicious?: boolean | null; // paid plans
};
type ApiError = { error: string; code?: string };

const EXAMPLES = [
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'],
  ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'],
  ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'],
  ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)']
] as const;

function DeviceIcon({ type }: { type: string }) {
  // Simple line drawings, one per device type.
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'mobile')
    return (
      <svg viewBox="0 0 48 48" {...common}>
        <rect x="14" y="5" width="20" height="38" rx="4" />
        <path d="M21 38h6" />
      </svg>
    );
  if (type === 'tablet')
    return (
      <svg viewBox="0 0 48 48" {...common}>
        <rect x="8" y="6" width="32" height="36" rx="4" />
        <path d="M22 37h4" />
      </svg>
    );
  if (type === 'bot')
    return (
      <svg viewBox="0 0 48 48" {...common}>
        <rect x="10" y="14" width="28" height="22" rx="6" />
        <circle cx="19" cy="25" r="2.5" />
        <circle cx="29" cy="25" r="2.5" />
        <path d="M24 14V8M20 31h8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 48 48" {...common}>
      <rect x="6" y="8" width="36" height="24" rx="3" />
      <path d="M18 40h12M24 32v8" />
    </svg>
  );
}

const named = (p: Part) => [p.name, p.version].filter(Boolean).join(' ') || 'Unknown';

export default function UaApp() {
  const [ua, setUa] = useState('');
  const [data, setData] = useState<Parsed | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = useCallback(async (payload: { ua?: string; mine?: 1 }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) throw body;
      setData(body);
      setUa(body.ua);
    } catch (e) {
      setData(null);
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // ?ua=... opens on that string; otherwise start with the visitor's own browser.
    const fromUrl = new URLSearchParams(window.location.search).get('ua');
    parse(fromUrl ? { ua: fromUrl } : { mine: 1 });
  }, [parse]);

  if (error?.code === 'missing_key') {
    return (
      <main className="page">
        <section className="card missing">
          <h1>Add your API key</h1>
          <p>
            Get a free APIVerve key at{' '}
            <a href="https://dashboard.apiverve.com/signup?api=useragentparser" target="_blank" rel="noreferrer">
              dashboard.apiverve.com
            </a>
            , set <code>APIVERVE_API_KEY</code> in <code>.env</code> or your Vercel project, then reload.
          </p>
        </section>
      </main>
    );
  }

  const v = data?.versionCheck;
  const deviceName = data ? [data.device.vendor, data.device.model].filter(Boolean).join(' ') : '';

  return (
    <main className="page">
      <header className="top">
        <h1>
          What’s this <span>browser?</span>
        </h1>
        <p>Paste any user agent string, or start with your own.</p>
      </header>

      <section className="card">
        <textarea value={ua} onChange={(e) => setUa(e.target.value)} rows={3} spellCheck={false} placeholder="Mozilla/5.0 (…)" aria-label="User agent" />
        <div className="bar">
          <div className="examples">
            {EXAMPLES.map(([label, s]) => (
              <button key={label} onClick={() => parse({ ua: s })}>
                {label}
              </button>
            ))}
          </div>
          <div className="go">
            <button className="ghost" onClick={() => parse({ mine: 1 })}>
              Mine
            </button>
            <button className="primary" onClick={() => parse({ ua })} disabled={busy || !ua.trim()}>
              {busy ? 'Parsing…' : 'Parse'}
            </button>
          </div>
        </div>
        {error && <p className="err">{error.error}</p>}
      </section>

      {data && (
        <section className="result">
          <div className={`hero ${data.isBot ? 'bot' : ''}`}>
            <div className="icon">
              <DeviceIcon type={data.deviceType} />
            </div>
            <div>
              <span className="kicker">{data.isBot ? 'A bot or crawler' : `A ${data.deviceType} ${data.clientType}`}</span>
              <h2>{data.summary || `${named(data.browser)} on ${named(data.os)}`}</h2>
            </div>
          </div>

          <div className="tiles">
            <div className="tile">
              <span>Browser</span>
              <strong>{named(data.browser)}</strong>
            </div>
            <div className="tile">
              <span>Operating system</span>
              <strong>{named(data.os)}</strong>
            </div>
            <div className="tile">
              <span>Device</span>
              <strong>{deviceName || (data.isMobile ? 'Mobile device' : data.deviceType.charAt(0).toUpperCase() + data.deviceType.slice(1))}</strong>
            </div>
            <div className="tile">
              <span>Engine</span>
              <strong>{data.engine?.name ? named(data.engine) : '—'}</strong>
            </div>
          </div>

          {v && (
            <div className={`fresh ${v.isOutdated ? 'old' : 'ok'}`}>
              <strong>{v.isOutdated ? `${v.majorsBehind} versions behind` : 'Up to date'}</strong>
              <span>
                Latest {v.browserFamily} is {v.latestVersion}
                {v.osEndOfLife && ' · this OS version no longer gets updates'}
              </span>
            </div>
          )}
        </section>
      )}

      <footer className="foot">
        Built with the <a href="https://apiverve.com/marketplace/useragentparser">User Agent Parser</a> API from APIVerve.
      </footer>
    </main>
  );
}
