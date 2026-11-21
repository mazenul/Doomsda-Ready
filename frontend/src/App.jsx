import React, { useState } from 'react';
import Movies from './views/Movies.jsx';
import RewatchPlan from './views/RewatchPlan.jsx';
import Booking from './views/Booking.jsx';

const TABS = [
  ['movies', 'Movies', Movies],
  ['plan', 'Rewatch Plan', RewatchPlan],
  ['booking', 'Booking', Booking],
];

export default function App() {
  const [tab, setTab] = useState('movies');
  const View = TABS.find(([key]) => key === tab)[2];
  return (
    <main>
      <h1>Doomsday Ready</h1>
      <nav>
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      {/* Each view loads fresh data from the API when it is shown. */}
      <View />
    </main>
  );
}
