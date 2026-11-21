import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const fmt = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

export default function RewatchPlan() {
  const [movies, setMovies] = useState([]);
  const [targetId, setTargetId] = useState('');
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listMovies().then(setMovies).catch((e) => setError(e.message));
  }, []);

  const loadPlan = async (id, silent) => {
    if (!id) return setPlan(null);
    try {
      setError('');
      setPlan(await api.rewatchOrder(id));
    } catch (e) {
      if (!silent) setError(e.message);
    }
  };

  const pick = (id) => {
    setTargetId(id);
    loadPlan(id);
  };

  const toggleWatched = async (m) => {
    try {
      await api.updateMovie(m.id, { watched: !m.watched });
      await loadPlan(targetId, true);
    } catch (e) {
      setError(e.message);
    }
  };

  const pct = plan && plan.totalCount > 0 ? (plan.watchedCount / plan.totalCount) * 100 : 100;

  return (
    <>
      <section>
        <label>Target movie
          <select value={targetId} onChange={(e) => pick(e.target.value)}>
            <option value="">Select a movie…</option>
            {movies.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>
      </section>

      {error && <div className="error">{error}</div>}

      {plan && (
        <section>
          <strong>Before {plan.target.title}</strong>
          {plan.totalCount === 0 ? (
            <p className="muted">Nothing to rewatch first.</p>
          ) : (
            <>
              <div>{plan.watchedCount} of {plan.totalCount} watched</div>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
              <div className="muted">Remaining watch time: {fmt(plan.remainingRuntimeMinutes)} ({plan.remainingRuntimeMinutes} min)</div>
              <ol>
                {plan.order.map((m) => (
                  <li key={m.id} className={m.watched ? 'done' : ''}>
                    <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: '1rem', display: 'inline-flex' }}>
                      <input type="checkbox" checked={m.watched} onChange={() => toggleWatched(m)} />
                      {m.title} <span className="muted">({m.releaseYear}, {m.runtimeMinutes} min)</span>
                    </label>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </>
  );
}
