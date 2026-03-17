/**
 * normalmap.js — Sobel Filter: Height Map → Normal Map conversion.
 * Computes per-pixel surface normals from grayscale height data.
 */

const NormalMapConverter = (() => {
  /**
   * Convert a height map (grayscale RGBA pixels) to a normal map.
   * @param {Uint8ClampedArray} heightPixels  — source height map RGBA
   * @param {Uint8ClampedArray} normalPixels  — destination normal map RGBA (same size)
   * @param {number} width
   * @param {number} height
   * @param {number} strength  — 0..1, controls how pronounced the normals are
   */
  function convert(heightPixels, normalPixels, width, height, strength = 0.5) {
    // Strength scaling: map [0,1] → [0.5, 8]
    const s = 0.5 + strength * 7.5;

    function getHeight(x, y) {
      // Clamp to edges (repeat-edge)
      x = Math.max(0, Math.min(width - 1, x));
      y = Math.max(0, Math.min(height - 1, y));
      return heightPixels[(y * width + x) * 4] / 255;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Sobel 3x3 kernels
        const tl = getHeight(x - 1, y - 1);
        const t  = getHeight(x,     y - 1);
        const tr = getHeight(x + 1, y - 1);
        const l  = getHeight(x - 1, y);
        const r  = getHeight(x + 1, y);
        const bl = getHeight(x - 1, y + 1);
        const b  = getHeight(x,     y + 1);
        const br = getHeight(x + 1, y + 1);

        // Sobel X gradient  (right - left)
        const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
        // Sobel Y gradient  (bottom - top)
        const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

        // Normal vector (not yet normalized)
        const nx = -dX * s;
        const ny = -dY * s;
        const nz = 1.0;

        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const nnx = nx / len;
        const nny = ny / len;
        const nnz = nz / len;

        // Encode to RGB: map [-1,1] → [0,255]
        const idx = (y * width + x) * 4;
        normalPixels[idx]     = Math.round((nnx * 0.5 + 0.5) * 255); // R
        normalPixels[idx + 1] = Math.round((nny * 0.5 + 0.5) * 255); // G
        normalPixels[idx + 2] = Math.round((nnz * 0.5 + 0.5) * 255); // B
        normalPixels[idx + 3] = 255;
      }
    }
  }

  return { convert };
})();

window.NormalMapConverter = NormalMapConverter;
