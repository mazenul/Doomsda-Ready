const fs = require('fs');
const path = require('path');

// Small in-memory store with optional JSON-file persistence (set DATA_FILE).
class Store {
  constructor(file) {
    this.file = file || null;
    this.data = { movies: [], cinemas: [], nextMovieId: 1, nextCinemaId: 1 };
    if (this.file && fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    }
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  /** Run fn(data). If it throws, every change is rolled back (all-or-nothing). */
  transaction(fn) {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    try {
      const result = fn(this.data);
      this.save();
      return result;
    } catch (err) {
      this.data = snapshot;
      throw err;
    }
  }
}

module.exports = { Store };
