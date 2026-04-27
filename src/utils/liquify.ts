export type LiquifyMode = 'push' | 'twirl_cw' | 'twirl_ccw' | 'pinch' | 'bloat' | 'smooth' | 'turbulence';

export interface LiquifyOptions {
  interpolation: 'bilinear' | 'bicubic';
  brushHardness: number; // 0 = soft (smoothstep), 1 = hard
  sharpenAmount: number; // 0 = no sharpening, 1 = max sharpening
}

/**
 * Catmull-Rom bicubic interpolation kernel
 */
function cubicKernel(t: number): number {
  const at = Math.abs(t);
  if (at < 1) return 1 - 2.5 * at * at + 1.5 * at * at * at;
  if (at < 2) return 2 - 4 * at + 2.5 * at * at - 0.5 * at * at * at;
  return 0;
}

/**
 * Sample using Bicubic (Catmull-Rom) - Sharper
 */
function sampleBicubic(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: number[]): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 0;
  for (let dy = -1; dy <= 2; dy++) {
    const wy = cubicKernel(dy - fy);
    if (wy === 0) continue;
    const sy = Math.max(0, Math.min(h - 1, iy + dy));
    for (let dx = -1; dx <= 2; dx++) {
      const wx = cubicKernel(dx - fx);
      if (wx === 0) continue;
      const sx = Math.max(0, Math.min(w - 1, ix + dx));
      const idx = (sy * w + sx) * 4;
      const weight = wx * wy;
      out[0] += src[idx] * weight;
      out[1] += src[idx + 1] * weight;
      out[2] += src[idx + 2] * weight;
      out[3] += src[idx + 3] * weight;
    }
  }
}

/**
 * Sample using Bilinear - Smoother
 */
function sampleBilinear(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: number[]): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - x0;
  const fy = y - y0;

  const idx00 = (y0 * w + x0) * 4;
  const idx10 = (y0 * w + x1) * 4;
  const idx01 = (y1 * w + x0) * 4;
  const idx11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  out[0] = src[idx00] * w00 + src[idx10] * w10 + src[idx01] * w01 + src[idx11] * w11;
  out[1] = src[idx00 + 1] * w00 + src[idx10 + 1] * w10 + src[idx01 + 1] * w01 + src[idx11 + 1] * w11;
  out[2] = src[idx00 + 2] * w00 + src[idx10 + 2] * w10 + src[idx01 + 2] * w01 + src[idx11 + 2] * w11;
  out[3] = src[idx00 + 3] * w00 + src[idx10 + 3] * w10 + src[idx01 + 3] * w01 + src[idx11 + 3] * w11;
}

/**
 * Apply liquify effect with advanced options
 */
export function applyLiquify(
  imageData: ImageData,
  cx: number,
  cy: number,
  radius: number,
  strength: number,
  mode: LiquifyMode,
  dx: number,
  dy: number,
  options: LiquifyOptions = { interpolation: 'bicubic', brushHardness: 0.5, sharpenAmount: 0.2 }
): ImageData {
  const { width, height, data } = imageData;
  const srcData = new Uint8ClampedArray(data);

  const radiusSq = radius * radius;
  // Reduce overall strength slightly to make slider feel more natural
  const effectiveStrength = strength * 0.35;

  // Bounding box for optimization
  const minX = Math.max(0, Math.floor(cx - radius) - 2);
  const maxX = Math.min(width - 1, Math.ceil(cx + radius) + 2);
  const minY = Math.max(0, Math.floor(cy - radius) - 2);
  const maxY = Math.min(height - 1, Math.ceil(cy + radius) + 2);

  const sample: number[] = [0, 0, 0, 0];
  const isBicubic = options.interpolation === 'bicubic';

  // 1. Distortion Pass
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dxPixel = x - cx;
      const dyPixel = y - cy;
      const distSq = dxPixel * dxPixel + dyPixel * dyPixel;

      if (distSq >= radiusSq) continue;

      const dist = Math.sqrt(distSq);
      const normalizedDist = dist / radius;

      // Brush hardness blending
      // Hardness = 1.0 means no falloff (full strength everywhere). Hardness = 0.0 means cubic falloff.
      const rawFalloff = Math.max(0, 1 - normalizedDist * normalizedDist);
      const cubicFalloff = rawFalloff * rawFalloff * (3 - 2 * rawFalloff);
      const falloff = cubicFalloff * (1 - options.brushHardness) + rawFalloff * options.brushHardness;

      let srcX = x;
      let srcY = y;

      switch (mode) {
        case 'push': {
          srcX = x - dx * effectiveStrength * falloff * 2.0;
          srcY = y - dy * effectiveStrength * falloff * 2.0;
          break;
        }
        case 'twirl_cw':
        case 'twirl_ccw': {
          if (dist < 1) break;
          const angle = effectiveStrength * falloff * (mode === 'twirl_cw' ? 1 : -1) * 0.25;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          srcX = cx + dxPixel * cos - dyPixel * sin;
          srcY = cy + dxPixel * sin + dyPixel * cos;
          break;
        }
        case 'pinch': {
          const pinchStr = effectiveStrength * falloff * 0.25;
          srcX = x + dxPixel * pinchStr;
          srcY = y + dyPixel * pinchStr;
          break;
        }
        case 'bloat': {
          const bloatStr = effectiveStrength * falloff * 0.25;
          srcX = x - dxPixel * bloatStr;
          srcY = y - dyPixel * bloatStr;
          break;
        }
        case 'smooth': {
          // Blur pass
          const blurRadius = Math.max(1, Math.round(effectiveStrength * radius * 0.08));
          let rSum = 0, gSum = 0, bSum = 0, count = 0;

          for (let ky = -blurRadius; ky <= blurRadius; ky++) {
            for (let kx = -blurRadius; kx <= blurRadius; kx++) {
              const sx = x + kx;
              const sy = y + ky;
              if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                const idx = (sy * width + sx) * 4;
                const kDist = Math.sqrt(kx * kx + ky * ky);
                const kWeight = Math.max(0, 1 - kDist / blurRadius);
                rSum += srcData[idx] * kWeight;
                gSum += srcData[idx + 1] * kWeight;
                bSum += srcData[idx + 2] * kWeight;
                count += kWeight;
              }
            }
          }

          if (count > 0) {
            const idx = (y * width + x) * 4;
            const blend = Math.min(0.7, effectiveStrength * 0.6) * falloff;
            data[idx] = Math.round(srcData[idx] * (1 - blend) + (rSum / count) * blend);
            data[idx + 1] = Math.round(srcData[idx + 1] * (1 - blend) + (gSum / count) * blend);
            data[idx + 2] = Math.round(srcData[idx + 2] * (1 - blend) + (bSum / count) * blend);
          }
          continue; // Skip interpolation for smooth mode
        }
        case 'turbulence': {
          const noiseAngle = ((x * 12.9898 + y * 78.233) * 43758.5453) % (Math.PI * 2);
          const turbStr = effectiveStrength * falloff * radius * 0.15;
          srcX = x + Math.cos(noiseAngle) * turbStr;
          srcY = y + Math.sin(noiseAngle) * turbStr;
          break;
        }
      }

      srcX = Math.max(0, Math.min(width - 1, srcX));
      srcY = Math.max(0, Math.min(height - 1, srcY));

      // Resample
      if (isBicubic) {
        sampleBicubic(srcData, width, height, srcX, srcY, sample);
      } else {
        sampleBilinear(srcData, width, height, srcX, srcY, sample);
      }

      const outIdx = (y * width + x) * 4;
      data[outIdx]     = Math.max(0, Math.min(255, Math.round(sample[0])));
      data[outIdx + 1] = Math.max(0, Math.min(255, Math.round(sample[1])));
      data[outIdx + 2] = Math.max(0, Math.min(255, Math.round(sample[2])));
      data[outIdx + 3] = Math.max(0, Math.min(255, Math.round(sample[3])));
    }
  }

  // 2. Localized Sharpening Pass (Controlled by options.sharpenAmount)
  if (mode !== 'smooth' && options.sharpenAmount > 0) {
    const sharpened = new Uint8ClampedArray(data);
    const localMinX = Math.max(1, minX);
    const localMaxX = Math.min(width - 2, maxX);
    const localMinY = Math.max(1, minY);
    const localMaxY = Math.min(height - 2, maxY);

    for (let y = localMinY; y <= localMaxY; y++) {
      for (let x = localMinX; x <= localMaxX; x++) {
        const dxPixel = x - cx;
        const dyPixel = y - cy;
        const distSq = dxPixel * dxPixel + dyPixel * dyPixel;
        if (distSq >= radiusSq) continue;

        const dist = Math.sqrt(distSq);
        const normalizedDist = dist / radius;

        // Fades sharpening out at the edges
        const sFalloff = Math.max(0, 1 - normalizedDist);
        const sFalloffCubic = sFalloff * sFalloff * (3 - 2 * sFalloff);
        
        // Final sharpening coefficient
        const localSharp = options.sharpenAmount * sFalloffCubic * 0.35; // Maximum 0.35 to prevent severe ringing

        if (localSharp < 0.005) continue;

        const idx = (y * width + x) * 4;
        const idxN = ((y - 1) * width + x) * 4;
        const idxS = ((y + 1) * width + x) * 4;
        const idxE = (y * width + x + 1) * 4;
        const idxW = (y * width + x - 1) * 4;

        for (let c = 0; c < 3; c++) {
          const center = sharpened[idx + c];
          const blurred = (sharpened[idxN + c] + sharpened[idxS + c] + sharpened[idxE + c] + sharpened[idxW + c]) * 0.25;
          
          // Unsharp mask
          const sharpVal = Math.round(center + localSharp * (center - blurred));
          data[idx + c] = Math.max(0, Math.min(255, sharpVal));
        }
      }
    }
  }

  return imageData;
}
