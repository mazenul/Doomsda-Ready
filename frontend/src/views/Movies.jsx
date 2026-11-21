import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

function PrereqPicker({ movies, selected, onChange, excludeId }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const options = movies.filter((m) => m.id !== excludeId);
  if (options.length === 0) return <span className="muted">No other movies yet</span>;
  return (
    <div className="prereqs">
      {options.map((m) => (
        <label key={m.id}>
          <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
          {m.title}
        </label>
      ))}
    </div>
  );
}

function MovieRow({ movie, movies, onChanged, onError }) {
  const [editing, setEditing] = useState(false);
  const [prereqs, setPrereqs] = useState(movie.prerequisites);
  const titleOf = (id) => movies.find((m) => m.id === id)?.title ?? `#${id}`;

  const run = async (fn) => {
    try {
      onError('');
      await fn();
      await onChanged();
    } catch (e) {
      onError(e.code ? `${e.code}: ${e.message}` : e.message);
    }
  };

  return (
    <div className="card">
      <div className="movie">
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
          <input
            type="checkbox"
            checked={movie.watched}
            onChange={(e) => run(() => api.updateMovie(movie.id, { watched: e.target.checked }))}
          />
          <strong>{movie.title}</strong>
          <span className="muted">
            {movie.releaseYear} · {movie.runtimeMinutes} min
          </span>
        </label>
        <button
          onClick={() => {
            setPrereqs(movie.prerequisites);
            setEditing(!editing);
          }}
        >
          {editing ? 'Cancel' : 'Edit prerequisites'}
        </button>
      </div>
      <div className="muted">
        Watch first: {movie.prerequisites.length ? movie.prerequisites.map(titleOf).join(', ') : 'none'}
      </div>
      {editing && (
        <>
          <PrereqPicker movies={movies} selected={prereqs} onChange={setPrereqs} excludeId={movie.id} />
          <button
            className="primary"
            onClick={() =>
              run(async () => {
                await api.updateMovie(movie.id, { prerequisites: prereqs });
                setEditing(false);
              })
            }
          >
            Save
          </button>
        </>
      )}
    </div>
  );
}

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', releaseYear: '', runtimeMinutes: '', prerequisites: [] });

  const load = useCallback(async () => {
    try {
      setMovies(await api.listMovies());
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await api.createMovie({
        title: form.title,
        releaseYear: Number(form.releaseYear),
        runtimeMinutes: Number(form.runtimeMinutes),
        prerequisites: form.prerequisites,
      });
      setForm({ title: '', releaseYear: '', runtimeMinutes: '', prerequisites: [] });
      await load();
    } catch (err) {
      setError(err.code ? `${err.code}: ${err.message}` : err.message);
    }
  };

  return (
    <>
      <section>
        <strong>Add a movie</strong>
        <form className="row" onSubmit={add}>
          <label>Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>Release year
            <input type="number" value={form.releaseYear} onChange={(e) => setForm({ ...form, releaseYear: e.target.value })} required />
          </label>
          <label>Runtime (min)
            <input type="number" min="1" max="300" value={form.runtimeMinutes} onChange={(e) => setForm({ ...form, runtimeMinutes: e.target.value })} required />
          </label>
          <button className="primary" type="submit">Add</button>
        </form>
        <div className="muted" style={{ marginTop: 8 }}>Watch these first (optional):</div>
        <PrereqPicker movies={movies} selected={form.prerequisites} onChange={(p) => setForm({ ...form, prerequisites: p })} />
      </section>

      {error && <div className="error">{error}</div>}

      {movies.length === 0 && <p className="muted">No movies yet.</p>}
      {movies.map((m) => (
        <MovieRow key={m.id} movie={m} movies={movies} onChanged={load} onError={setError} />
      ))}
    </>
  );
}
