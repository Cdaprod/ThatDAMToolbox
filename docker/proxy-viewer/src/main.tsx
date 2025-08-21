import { h, render } from 'preact';
import Router from 'preact-router';
import Live from './routes/Live';
import Pair from './routes/Pair';
import Health from './routes/Health';
import '@thatdamtoolbox/design-system';

function App() {
  const base = (import.meta.env.BASE_PATH || '/viewer').replace(/\/$/, '');
  return (
    <Router>
      <Live path={`${base}/live`} />
      <Pair path={`${base}/pair`} />
      <Health path={`${base}/health`} />
    </Router>
  );
}

render(<App />, document.getElementById('app') as HTMLElement);
