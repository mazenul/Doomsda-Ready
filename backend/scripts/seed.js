// Loads the sample data from the brief into a running API.
// Usage: npm run seed   (API_URL defaults to http://localhost:3000/api)
const API = process.env.API_URL || 'http://localhost:3000/api';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${json.error?.code}: ${json.error?.message}`);
  return json;
}

(async () => {
  try {
    // Prerequisites are given by title; they must appear earlier in the list.
    const movies = await post('/movies', [
      { title: 'Iron Man', releaseYear: 2008, runtimeMinutes: 126 },
      { title: 'Captain America: The First Avenger', releaseYear: 2011, runtimeMinutes: 124 },
      { title: 'The Avengers', releaseYear: 2012, runtimeMinutes: 143, prerequisites: ['Iron Man', 'Captain America: The First Avenger'] },
      { title: 'Captain America: Civil War', releaseYear: 2016, runtimeMinutes: 147, prerequisites: ['The Avengers'] },
      { title: 'Thor: Ragnarok', releaseYear: 2017, runtimeMinutes: 130 },
      { title: 'Avengers: Infinity War', releaseYear: 2018, runtimeMinutes: 149, prerequisites: ['Captain America: Civil War', 'Thor: Ragnarok'] },
      { title: 'Avengers: Endgame', releaseYear: 2019, runtimeMinutes: 181, prerequisites: ['Avengers: Infinity War'] },
      { title: 'Avengers: Doomsday', releaseYear: 2026, runtimeMinutes: 150, prerequisites: ['Avengers: Endgame'] },
    ]);
    const cinemas = await post('/cinemas', [
      { name: 'Starlight Cinema', bundleSizes: [1, 3, 4] },
      { name: 'Galaxy Multiplex', bundleSizes: [2, 5] },
      { name: 'Grand Premiere', bundleSizes: [6, 9, 20] },
      { name: 'Odd Seats Theatre', bundleSizes: [4, 6] },
    ]);
    console.log(`Seeded ${movies.length} movies and ${cinemas.length} cinemas.`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
})();
