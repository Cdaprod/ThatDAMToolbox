import { h } from 'preact';
import Player from '../components/Player';

export default function Live({ source }: { source?: string }) {
  return (
    <div class="h-screen flex flex-col">
      <Player source={source ?? 'default'} />
    </div>
  );
}
