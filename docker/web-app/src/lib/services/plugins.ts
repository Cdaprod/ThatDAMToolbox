// Minimal plugin registry for frontend service implementations

export type Capability = 'sequence.render' | 'video.analyze.motion';

export interface Plugin {
  name: string;
  provides: Capability[];
  impl: Record<string, any>;
}

const registry: Plugin[] = [];

export function registerPlugin(p: Plugin) { registry.push(p); }
export function find(cap: Capability): Plugin | undefined {
  return registry.find(p => p.provides.includes(cap));
}
export function all() { return registry.slice(); }

