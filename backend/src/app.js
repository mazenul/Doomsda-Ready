const express = require('express');
const cors = require('cors');
const { ApiError, validation, notFound, conflict } = require('./errors');
const { wouldCreateCycle, rewatchOrder } = require('./graph');
const { minBundles } = require('./booking');

const MIN_YEAR = 1888;
const MAX_YEAR = 2100;
const MAX_GROUP_SIZE = 10000;

// ---------- helpers ----------

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const norm = (s) => s.trim().toLowerCase();

function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) throw validation(`Invalid id "${raw}"`);
  return Number(raw);
}

function parseName(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validation(`${field} is required and must be a non-empty string`);
  }
  if (value.trim().length > 200) throw validation(`${field} must be at most 200 characters`);
  return value.trim();
}

function parseIntInRange(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw validation(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

// ---------- movies ----------

function parseMovieFields(input, partial) {
  if (!isPlainObject(input)) throw validation('Request body must be a JSON object');
  const out = {};

  if (!partial || input.title !== undefined) out.title = parseName(input.title, 'title');
  if (!partial || input.releaseYear !== undefined) {
    out.releaseYear = parseIntInRange(input.releaseYear, 'releaseYear', MIN_YEAR, MAX_YEAR);
  }
  if (!partial || input.runtimeMinutes !== undefined) {
    out.runtimeMinutes = parseIntInRange(input.runtimeMinutes, 'runtimeMinutes', 1, 300);
  }
  if (input.watched !== undefined) {
    if (typeof input.watched !== 'boolean') throw validation('watched must be true or false');
    out.watched = input.watched;
  }
  if (input.prerequisites !== undefined) {
    if (!Array.isArray(input.prerequisites)) {
      throw validation('prerequisites must be an array of movie ids (or titles)');
    }
    out.prerequisites = input.prerequisites;
  }
  if (partial && Object.keys(out).length === 0) {
    throw validation('Nothing to update: provide at least one of title, releaseYear, runtimeMinutes, watched, prerequisites');
  }
  return out;
}

function assertTitleFree(data, title, exceptId) {
  const clash = data.movies.find((m) => norm(m.title) === norm(title) && m.id !== exceptId);
  if (clash) throw conflict('DUPLICATE_TITLE', `A movie titled "${clash.title}" already exists`);
}

// Accepts movie ids (numbers) or exact titles (strings, case-insensitive).
// Returns de-duplicated ids in the order given.
function resolvePrerequisites(data, raw, ownTitle) {
  const ids = [];
  for (const item of raw) {
    let movie;
    if (typeof item === 'number' && Number.isInteger(item)) {
      movie = data.movies.find((m) => m.id === item);
      if (!movie) throw validation(`Prerequisite movie with id ${item} does not exist`);
    } else if (typeof item === 'string' && item.trim() !== '') {
      if (ownTitle && norm(item) === norm(ownTitle)) {
        throw conflict('CIRCULAR_DEPENDENCY', 'A movie cannot be a prerequisite of itself');
      }
      movie = data.movies.find((m) => norm(m.title) === norm(item));
      if (!movie) throw validation(`Prerequisite movie titled "${item}" does not exist`);
    } else {
      throw validation('Each prerequisite must be a movie id (integer) or a movie title (string)');
    }
    if (!ids.includes(movie.id)) ids.push(movie.id);
  }
  return ids;
}

function createMovie(data, input) {
  const f = parseMovieFields(input, false);
  assertTitleFree(data, f.title);
  const prerequisites = resolvePrerequisites(data, f.prerequisites || [], f.title);
  // A brand-new movie has no dependents, so it cannot close a cycle.
  const movie = {
    id: data.nextMovieId++,
    title: f.title,
    releaseYear: f.releaseYear,
    runtimeMinutes: f.runtimeMinutes,
    prerequisites,
    watched: f.watched === true,
  };
  data.movies.push(movie);
  return movie;
}

function updateMovie(data, id, input) {
  const movie = data.movies.find((m) => m.id === id);
  if (!movie) throw notFound(`Movie ${id} not found`);
  const f = parseMovieFields(input, true);

  if (f.title !== undefined) assertTitleFree(data, f.title, id);

  let newPrereqs;
  if (f.prerequisites !== undefined) {
    newPrereqs = resolvePrerequisites(data, f.prerequisites, f.title ?? movie.title);
    const byId = new Map(data.movies.map((m) => [m.id, m]));
    if (wouldCreateCycle(byId, id, newPrereqs)) {
      throw conflict('CIRCULAR_DEPENDENCY', 'This change would create a circular dependency between movies');
    }
  }

  if (f.title !== undefined) movie.title = f.title;
  if (f.releaseYear !== undefined) movie.releaseYear = f.releaseYear;
  if (f.runtimeMinutes !== undefined) movie.runtimeMinutes = f.runtimeMinutes;
  if (f.watched !== undefined) movie.watched = f.watched;
  if (newPrereqs !== undefined) movie.prerequisites = newPrereqs;
  return movie;
}

// ---------- cinemas ----------

function createCinema(data, input) {
  if (!isPlainObject(input)) throw validation('Request body must be a JSON object');
  const name = parseName(input.name, 'name');

  const sizes = input.bundleSizes;
  if (!Array.isArray(sizes) || sizes.length < 1 || sizes.length > 10) {
    throw validation('bundleSizes must be an array of 1 to 10 integers');
  }
  sizes.forEach((s) => parseIntInRange(s, 'each bundle size', 1, 500));
  if (new Set(sizes).size !== sizes.length) throw validation('bundleSizes must be different from each other (no duplicates)');

  const clash = data.cinemas.find((c) => norm(c.name) === norm(name));
  if (clash) throw conflict('DUPLICATE_NAME', `A cinema named "${clash.name}" already exists`);

  const cinema = { id: data.nextCinemaId++, name, bundleSizes: [...sizes].sort((a, b) => a - b) };
  data.cinemas.push(cinema);
  return cinema;
}

// ---------- app ----------

function createApp(store) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  const wrap = (fn) => (req, res, next) => {
    try { fn(req, res); } catch (e) { next(e); }
  };

  api.post('/movies', wrap((req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      if (body.length === 0) throw validation('Provide at least one movie');
      // Items are created in order, so later items may list earlier ones (by title) as prerequisites.
      const created = store.transaction((data) => body.map((item) => createMovie(data, item)));
      return res.status(201).json(created);
    }
    const created = store.transaction((data) => createMovie(data, body));
    res.status(201).json(created);
  }));

  api.get('/movies', wrap((req, res) => res.json(store.data.movies)));

  api.get('/movies/:id', wrap((req, res) => {
    const id = parseId(req.params.id);
    const movie = store.data.movies.find((m) => m.id === id);
    if (!movie) throw notFound(`Movie ${id} not found`);
    res.json(movie);
  }));

  api.patch('/movies/:id', wrap((req, res) => {
    const id = parseId(req.params.id);
    res.json(store.transaction((data) => updateMovie(data, id, req.body)));
  }));

  api.get('/movies/:id/rewatch-order', wrap((req, res) => {
    const id = parseId(req.params.id);
    const { movies } = store.data;
    const target = movies.find((m) => m.id === id);
    if (!target) throw notFound(`Movie ${id} not found`);

    const byId = new Map(movies.map((m) => [m.id, m]));
    const order = rewatchOrder(byId, id).map((mid) => byId.get(mid));
    const watched = order.filter((m) => m.watched);
    const unwatched = order.filter((m) => !m.watched);

    res.json({
      target: { id: target.id, title: target.title },
      order: order.map((m) => ({
        id: m.id,
        title: m.title,
        releaseYear: m.releaseYear,
        runtimeMinutes: m.runtimeMinutes,
        watched: m.watched,
      })),
      totalCount: order.length,
      watchedCount: watched.length,
      remainingRuntimeMinutes: unwatched.reduce((sum, m) => sum + m.runtimeMinutes, 0),
    });
  }));

  api.post('/cinemas', wrap((req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      if (body.length === 0) throw validation('Provide at least one cinema');
      const created = store.transaction((data) => body.map((item) => createCinema(data, item)));
      return res.status(201).json(created);
    }
    res.status(201).json(store.transaction((data) => createCinema(data, body)));
  }));

  api.get('/cinemas', wrap((req, res) => res.json(store.data.cinemas)));

  api.get('/cinemas/:id/booking', wrap((req, res) => {
    const id = parseId(req.params.id);
    const cinema = store.data.cinemas.find((c) => c.id === id);
    if (!cinema) throw notFound(`Cinema ${id} not found`);

    const raw = req.query.groupSize;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_GROUP_SIZE) {
      throw validation(`groupSize query parameter must be an integer between 1 and ${MAX_GROUP_SIZE}`);
    }
    const groupSize = Number(raw);
    const result = minBundles(cinema.bundleSizes, groupSize);

    res.json({
      cinema: { id: cinema.id, name: cinema.name, bundleSizes: cinema.bundleSizes },
      groupSize,
      ...result,
      message: result.possible
        ? `${result.totalBundles} bundle(s) cover exactly ${groupSize} seats`
        : `Not possible: no combination of the bundle sizes adds up to exactly ${groupSize} seats`,
    });
  }));

  api.use((req, res, next) => next(notFound(`No route for ${req.method} ${req.originalUrl}`)));
  app.use('/api', api);
  app.use((req, res, next) => next(notFound(`No route for ${req.method} ${req.originalUrl}`)));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
  });

  return app;
}

module.exports = { createApp };
