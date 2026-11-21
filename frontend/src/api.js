const BASE = '/api';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message || `Request failed (${res.status})`);
    err.code = json.error?.code;
    throw err;
  }
  return json;
}

export const api = {
  listMovies: () => request('GET', '/movies'),
  createMovie: (m) => request('POST', '/movies', m),
  updateMovie: (id, patch) => request('PATCH', `/movies/${id}`, patch),
  rewatchOrder: (id) => request('GET', `/movies/${id}/rewatch-order`),
  listCinemas: () => request('GET', '/cinemas'),
  createCinema: (c) => request('POST', '/cinemas', c),
  booking: (id, groupSize) => request('GET', `/cinemas/${id}/booking?groupSize=${encodeURIComponent(groupSize)}`),
};
