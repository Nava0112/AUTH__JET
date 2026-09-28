import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const labels = { openid: 'Verify your AuthJet identity', profile: 'View your profile', email: 'View your email address' };

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const requestId = params.get('request_id');
  const [request, setRequest] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/oauth/consent/${encodeURIComponent(requestId || '')}`, { credentials: 'include' })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => ok ? setRequest(data) : setError(data.error_description || 'Authorization request expired'))
      .catch(() => setError('Unable to load the authorization request'));
  }, [requestId]);

  const decide = async decision => {
    setLoading(true);
    const response = await fetch(`${API_URL}/oauth/consent`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId, decision })
    });
    const data = await response.json();
    if (response.ok && data.redirect_uri) window.location.assign(data.redirect_uri);
    else setError(data.error_description || 'Unable to complete consent');
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">AuthJet permissions</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{request?.client_name || 'This application'} wants access</h1>
        <ul className="mt-6 space-y-3 text-slate-700">{(request?.scopes || []).map(scope => <li key={scope} className="rounded bg-slate-50 p-3">{labels[scope] || scope}</li>)}</ul>
        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-8 grid grid-cols-2 gap-3"><button disabled={loading} onClick={() => decide('deny')} className="rounded border p-3 font-semibold text-slate-700">Deny</button><button disabled={loading || !request} onClick={() => decide('allow')} className="rounded bg-indigo-600 p-3 font-semibold text-white">Allow</button></div>
      </section>
    </main>
  );
};

export default OAuthConsent;