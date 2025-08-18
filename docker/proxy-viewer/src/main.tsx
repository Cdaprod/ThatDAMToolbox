import { h, render } from 'preact';
import Router from 'preact-router';
import Live from './routes/Live';
import Pair from './routes/Pair';
import Health from './routes/Health';

function App() {
  return (
    <Router>
      <Live path="/viewer/live" />
      <Pair path="/viewer/pair" />
      <Health path="/viewer/health" />
    </Router>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);
