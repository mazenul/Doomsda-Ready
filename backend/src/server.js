const { createApp } = require('./app');
const { Store } = require('./store');

const port = process.env.PORT || 3000;
const store = new Store(process.env.DATA_FILE);

createApp(store).listen(port, () => {
  console.log(`Doomsday Ready API listening on http://localhost:${port}/api`);
});
