import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Booking() {
  const [cinemas, setCinemas] = useState([]);
  const [cinemaId, setCinemaId] = useState('');
  const [groupSize, setGroupSize] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [newCinema, setNewCinema] = useState({ name: '', sizes: '' });

  const loadCinemas = () => api.listCinemas().then(setCinemas).catch((e) => setError(e.message));
  useEffect(() => { loadCinemas(); }, []);

  const getQuote = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setQuote(await api.booking(cinemaId, groupSize));
    } catch (err) {
      setQuote(null);
      setError(err.message);
    }
  };

  const addCinema = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const sizes = newCinema.sizes.split(',').map((s) => s.trim()).filter(Boolean).map(Number);
      await api.createCinema({ name: newCinema.name, bundleSizes: sizes });
      setNewCinema({ name: '', sizes: '' });
      await loadCinemas();
    } catch (err) {
      setError(err.code ? `${err.code}: ${err.message}` : err.message);
    }
  };

  return (
    <>
      <section>
        <form className="row" onSubmit={getQuote}>
          <label>Cinema
            <select value={cinemaId} onChange={(e) => { setCinemaId(e.target.value); setQuote(null); }} required>
              <option value="">Select a cinema…</option>
              {cinemas.map((c) => (
                <option key={c.id} value={c.id}>{c.name} (bundles: {c.bundleSizes.join(', ')})</option>
              ))}
            </select>
          </label>
          <label>Group size (1–10,000)
            <input type="number" min="1" max="10000" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} required />
          </label>
          <button className="primary" type="submit">Get quote</button>
        </form>

        {error && <div className="error">{error}</div>}

        {quote && (
          <div style={{ marginTop: 12 }}>
            {quote.possible ? (
              <>
                <strong>{quote.totalBundles} bundle{quote.totalBundles === 1 ? '' : 's'} for {quote.groupSize} seats</strong>
                <ul>
                  {quote.bundles.map((b) => (
                    <li key={b.size}>{b.size} seats × {b.count}</li>
                  ))}
                </ul>
              </>
            ) : (
              <strong>Not possible — no combination of bundles adds up to exactly {quote.groupSize} seats.</strong>
            )}
          </div>
        )}
      </section>

      <section>
        <strong>Add a cinema</strong>
        <form className="row" onSubmit={addCinema}>
          <label>Name
            <input value={newCinema.name} onChange={(e) => setNewCinema({ ...newCinema, name: e.target.value })} required />
          </label>
          <label>Bundle sizes (comma separated, 1–10 sizes of 1–500)
            <input value={newCinema.sizes} placeholder="2, 5" onChange={(e) => setNewCinema({ ...newCinema, sizes: e.target.value })} required />
          </label>
          <button className="primary" type="submit">Add</button>
        </form>
      </section>
    </>
  );
}
