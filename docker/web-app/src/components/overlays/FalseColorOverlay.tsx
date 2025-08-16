// /docker/web-app/src/components/overlays/FalseColorOverlay.tsx
import React from 'react';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-dom';
import { overlaySurfaceStyle } from '@/styles/theme';

const shaders = Shaders.create({
  falseColor: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      void main() {
        vec4 c = texture2D(t, uv);
        float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
        vec3 col;
        if (lum < 0.33) {
          col = vec3(0.0, 0.0, 1.0);
        } else if (lum < 0.66) {
          col = vec3(0.0, 1.0, 0.0);
        } else {
          col = vec3(1.0, 0.0, 0.0);
        }
        gl_FragColor = vec4(col, 0.5);
      }`
  }
});

interface Props {
  texture: HTMLImageElement | HTMLVideoElement | null;
  enabled: boolean;
}

const FalseColorOverlay: React.FC<Props> = ({ texture, enabled }) => {
  if (!enabled || !texture) return null;
  return (
    <Surface style={overlaySurfaceStyle} pixelRatio={window.devicePixelRatio}>
      <Node shader={shaders.falseColor} uniforms={{ t: texture }} />
    </Surface>
  );
};

export default FalseColorOverlay;