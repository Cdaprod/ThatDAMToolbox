// /docker/web-app/src/components/overlays/FocusPeakingOverlay.tsx
import React from 'react';
import { Shaders, Node, GLSL } from 'gl-react';
import { Surface } from 'gl-react-dom';
import { overlaySurfaceStyle } from '@/styles/theme';

const shaders = Shaders.create({
  focusPeaking: {
    frag: GLSL`
      precision highp float;
      varying vec2 uv;
      uniform sampler2D t;
      uniform vec2 resolution;
      void main() {
        // 3×3 Sobel kernel for edge detection
        float kernel[9];
        kernel[0] = -1.0; kernel[1] = -2.0; kernel[2] = -1.0;
        kernel[3] =  0.0; kernel[4] =  0.0; kernel[5] =  0.0;
        kernel[6] =  1.0; kernel[7] =  2.0; kernel[8] =  1.0;
        vec2 texel = 1.0 / resolution;
        float sum = 0.0;
        int idx = 0;
        for(int y = -1; y <= 1; y++) {
          for(int x = -1; x <= 1; x++) {
            vec2 off = vec2(float(x), float(y)) * texel;
            vec3 c = texture2D(t, uv + off).rgb;
            float lum = dot(c, vec3(0.299, 0.587, 0.114));
            sum += lum * kernel[idx++];
          }
        }
        float edge = abs(sum);
        if(edge > 0.3) {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 0.6);
        } else {
          discard;
        }
      }`
  }
});

interface Props {
  texture: HTMLImageElement | HTMLVideoElement | null;
  resolution: [number, number];
  enabled: boolean;
}

const FocusPeakingOverlay: React.FC<Props> = ({ texture, resolution, enabled }) => {
  if (!enabled || !texture) return null;
  return (
    <Surface style={overlaySurfaceStyle} pixelRatio={window.devicePixelRatio}>
      <Node shader={shaders.focusPeaking} uniforms={{ t: texture, resolution }} />
    </Surface>
  );
};

export default FocusPeakingOverlay;