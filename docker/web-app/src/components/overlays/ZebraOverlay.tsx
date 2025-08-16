// /docker/web-app/src/components/overlays/ZebraOverlay.tsx
import React from 'react';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-dom';
import { overlaySurfaceStyle } from '@/styles/theme';

const shaders = Shaders.create({
  zebras: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      uniform float threshold;
      void main() {
        vec4 c = texture2D(t, uv);
        float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
        // horizontal stripes: mod on uv.x
        float stripe = step(threshold, lum) * step(0.5, mod(uv.x * 50.0, 1.0));
        gl_FragColor = mix(c, vec4(1.0,1.0,1.0,1.0), stripe);
      }`
  }
});

interface Props {
  texture: HTMLImageElement | HTMLVideoElement | null;
  threshold?: number;
  enabled: boolean;
}

const ZebraOverlay: React.FC<Props> = ({ texture, threshold = 0.8, enabled }) => {
  if (!enabled || !texture) return null;
  return (
    <Surface style={overlaySurfaceStyle} pixelRatio={window.devicePixelRatio}>
      <Node shader={shaders.zebras} uniforms={{ t: texture, threshold }} />
    </Surface>
  );
};

export default ZebraOverlay;