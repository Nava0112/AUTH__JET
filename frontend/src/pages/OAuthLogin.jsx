import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const OAuthLogin = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestId = params.get('request_id');
  const [request, setRequest] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    fetch(`${API_URL}/oauth/request/${encodeURIComponent(requestId)}`, { credentials: 'include' })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => ok ? setRequest(data) : setError(data.error_description || 'Authorization request expired'))
      .catch(() => setError('Unable to load the authorization request'));
  }, [requestId]);

  const submit = async event => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/oauth/login`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || 'Login failed');
      navigate(`/oauth/consent?request_id=${encodeURIComponent(requestId)}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">AuthJet</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Sign in to continue</h1>
        <p className="mt-2 text-sm text-slate-600">{request?.client_name || 'The application'} is requesting access to your AuthJet account.</p>
        {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="mt-6 block text-sm font-medium text-slate-700">Email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded border p-3" /></label>
        <label className="mt-4 block text-sm font-medium text-slate-700">Password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border p-3" /></label>
        <button disabled={loading || !requestId} className="mt-6 w-full rounded bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">{loading ? 'Signing in...' : 'Continue'}</button>
      </form>
    </main>
  );
};

export default OAuthLogin;