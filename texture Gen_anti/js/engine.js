/**
 * engine.js — Parametric Micro-Texture Generator V2 Core Engine
 * Handles decoupled Arrangement (Array, Scatter, Voronoi) and Shape (Symbol, Cellular, Geometric, Image)
 */

window.TextureEngine = (() => {

  // Seeded PRNG (mulberry32)
  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Noise Generators for Voronoi / Cellular Mode ---
  const NoiseUtils = {
    hash2: function(ix, iy, seed) {
      let h = seed + ix * 374761393 + iy * 668265263;
      h = (h ^ (h >> 13)) * 1274126177;
      h = h ^ (h >> 16);
      return h;
    },
    evaluateVoronoi: function(x, y, jitter, seed) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      let f1 = 1e10, f2 = 1e10;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx;
          const cy = iy + dy;
          const h = this.hash2(cx, cy, seed);
          const px = dx + jitter * (((h & 0xffff) / 0xffff) - 0.5) + 0.5 - fx;
          const py = dy + jitter * ((((h >> 16) & 0xffff) / 0xffff) - 0.5) + 0.5 - fy;
          const d = px * px + py * py;
          if (d < f1) { f2 = f1; f1 = d; }
          else if (d < f2) { f2 = d; }
        }
      }
      return { f1: Math.sqrt(f1), f2: Math.sqrt(f2) };
    }
  };

  /**
   * Cellular Shape Renderer (Full-screen pass)
   */
  function renderCellular(pixels, width, height, params) {
    const freqX = params.tileX / 5;
    const freqY = params.tileY / 5;
    const jitter = params.jitterPos;
    const seed = params.seed;
    const oX = params.offsetX * width;
    const oY = params.offsetY * height;

    const cosR = Math.cos(params.globalRot);
    const sinR = Math.sin(params.globalRot);
    const cellularType = params.symbolType || 'f2_minus_f1'; // Used symbolType dropdown for subtypes

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let cx = x - width / 2 - oX;
        let cy = y - height / 2 - oY;
        
        let rx = cx * cosR - cy * sinR;
        let ry = cx * sinR + cy * cosR;

        let nx = (rx + width / 2) / width * freqX;
        let ny = (ry + height / 2) / height * freqY;

        const { f1, f2 } = NoiseUtils.evaluateVoronoi(nx, ny, jitter, seed);
        
        let val = 0;
        
        if (cellularType === 'f2_minus_f1') {
          val = (f2 - f1);
        } else if (cellularType === 'cracked') {
          // Sharp inverted drops around borders
          val = Math.max(0, 1.0 - (f2 - f1) * 4.0);
        } else if (cellularType === 'foam') {
          // Intersecting spheres style
          val = 1.0 - f1;
        }

        val = Math.min(val * 2.0, 1.0); // Normalize roughly to [0, 1]
        
        // Handle negative extrusion for cellular
        const absStrength = Math.abs(params.heightStrength);
        val = Math.pow(val, 1 / (0.1 + absStrength * 1.9));
        
        if (params.heightStrength < 0) {
          // Invert: base is high, cell features dig down
          val = 1.0 - val;
        }

        const byte = Math.max(0, Math.min(255, Math.round(val * 255)));
        const idx = (y * width + x) * 4;
        pixels[idx] = byte;
        pixels[idx + 1] = byte;
        pixels[idx + 2] = byte;
        pixels[idx + 3] = 255;
      }
    }
  }

  // --- Stamped Implementations (Array, Scatter, Voronoi Points + Symbol/Geometric/Image) ---

  const SYMBOLS = ['circle', 'triangle', 'square', 'cross', 'star', 'arrow', 'wave_line'];
  const GEOMETRIC = ['solid_circle', 'solid_square', 'octagon', 'pentagon', 'cross_plus', 'l_shape', 't_shape', 'gear', 'pinwheel'];

  function drawPolygon(ctx, sides, radius) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawShape(ctx, shapeMode, typeList, cx, cy, size, rotation, color, customImage, customSvgPath) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    
    if (shapeMode === 'image' && customImage) {
      // Draw custom uploaded image centered
      const w = size;
      const h = size * (customImage.height / customImage.width);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(customImage, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    const r = size / 2;
    ctx.lineWidth = Math.max(1, size * 0.15);
    ctx.lineCap = 'round';

    if (shapeMode === 'symbol') {
      const type = typeList;
      switch (type) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'triangle':
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const px = Math.cos(angle) * r * 0.85;
            const py = Math.sin(angle) * r * 0.85;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          break;
        case 'square':
          const half = r * 0.7;
          ctx.strokeRect(-half, -half, half * 2, half * 2);
          break;
        case 'cross':
          const arm = r * 0.75;
          ctx.beginPath();
          ctx.moveTo(-arm, -arm);
          ctx.lineTo(arm, arm);
          ctx.moveTo(arm, -arm);
          ctx.lineTo(-arm, arm);
          ctx.stroke();
          break;
        case 'star':
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const radius = (i % 2 === 0) ? r * 0.9 : r * 0.4;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
          break;
        case 'arrow':
          ctx.beginPath();
          ctx.moveTo(0, -r*0.8);
          ctx.lineTo(r*0.6, r*0.2);
          ctx.moveTo(0, -r*0.8);
          ctx.lineTo(-r*0.6, r*0.2);
          ctx.moveTo(0, -r*0.8);
          ctx.lineTo(0, r*0.8);
          ctx.stroke();
          break;
        case 'wave_line':
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.bezierCurveTo(-r/2, -r, r/2, r, r, 0);
          ctx.stroke();
          break;
        case 'custom_glyph':
          if (customSvgPath && customSvgPath.trim() !== '') {
            try {
              // Scale the path down roughly to fit 'r'
              ctx.save();
              ctx.scale(size / 100, size / 100); // assume path is roughly 0-100 bounding box
              // Center it roughly assuming 0..100 domain
              ctx.translate(-50, -50);
              const p = new Path2D(customSvgPath);
              ctx.fill(p);
              ctx.stroke(p);
              ctx.restore();
            } catch (e) {
              console.warn('Invalid SVG path', e);
            }
          } else {
            // fallback symbol if empty path
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
      }
    } else if (shapeMode === 'geometric') {
      const type = typeList;
      switch (type) {
        case 'solid_circle':
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'solid_square':
          ctx.fillRect(-r, -r, r * 2, r * 2);
          break;
        case 'octagon':
          drawPolygon(ctx, 8, r);
          ctx.fill();
          break;
        case 'pentagon':
          drawPolygon(ctx, 5, r);
          ctx.fill();
          break;
        case 'cross_plus':
          const w = r * 0.4;
          ctx.beginPath();
          ctx.rect(-r, -w/2, r*2, w);
          ctx.rect(-w/2, -r, w, r*2);
          ctx.fill();
          break;
        case 'l_shape':
          const lw = r * 0.5;
          ctx.beginPath();
          ctx.rect(-r, r - lw, r*2, lw); // horizontal
          ctx.rect(-r, -r, lw, r*2);     // vertical
          ctx.fill();
          break;
        case 't_shape':
          const tw = r * 0.5;
          ctx.beginPath();
          ctx.rect(-r, -r, r*2, tw);     // horizontal top
          ctx.rect(-tw/2, -r, tw, r*2);  // vertical center
          ctx.fill();
          break;
        case 'gear':
          const teeth = 8;
          ctx.beginPath();
          for (let i = 0; i < teeth * 2; i++) {
            const angle = (i / (teeth * 2)) * Math.PI * 2;
            const radius = (i % 2 === 0) ? r : r * 0.7;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          // hole
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.3, 0, Math.PI*2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'pinwheel':
          ctx.beginPath();
          for(let i=0; i<4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.moveTo(0, 0);
            ctx.lineTo(r, 0);
            ctx.lineTo(r, r*0.5);
          }
          ctx.fill();
          break;
      }
    }

    ctx.restore();
  }

  function renderStamped(pixels, width, height, params) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext('2d');

    // For absolute intensity
    const isNegative = params.heightStrength < 0;
    const absStrength = Math.abs(params.heightStrength);

    // Background
    // If negative (engraving), base surface is white (high) and stamps are dark (low)
    // If positive (embossing), base surface is black (low) and stamps are white (high)
    const baseColor = isNegative ? '#FFFFFF' : '#000000';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);

    const rng = mulberry32(params.seed);
    const tileX = Math.max(1, params.tileX);
    const tileY = Math.max(1, params.tileY);
    
    // We compute grid spacing based on tile counts
    const spacingX = width / tileX;
    const spacingY = height / tileY;
    
    // Base size depends on how many fit in a tile
    const baseSize = Math.min(spacingX, spacingY) * params.scale;
    
    // Inverse intensity for stamps based on positive/negative
    let shapeIntensity;
    if (isNegative) {
      // Base is 255. High absStrength means deep engraving (darker colors).
      shapeIntensity = Math.round(255 - (80 + absStrength * 175));
    } else {
      // Base is 0. High absStrength means tall embossing (brighter colors).
      shapeIntensity = Math.round(80 + absStrength * 175);
    }
    const color = `rgb(${shapeIntensity},${shapeIntensity},${shapeIntensity})`;

    // Global transforms
    const cosR = Math.cos(params.globalRot);
    const sinR = Math.sin(params.globalRot);
    const oX = width / 2 + (params.offsetX * width);
    const oY = height / 2 + (params.offsetY * height);

    // Padding grid so we don't clip when translated/rotated
    const pad = 2;

    for (let row = -pad; row < tileY + pad; row++) {
      for (let col = -pad; col < tileX + pad; col++) {
        
        // Base coordinate (local unrotated grid space centered at 0,0)
        let lx = (col - tileX/2 + 0.5) * spacingX;
        let ly = (row - tileY/2 + 0.5) * spacingY;

        // Arrangement overrides
        if (params.arrangement === 'scatter') {
          // Intense jitter effectively completely scrambles the grid
          lx += (rng() - 0.5) * spacingX * 1.5;
          ly += (rng() - 0.5) * spacingY * 1.5;
        } else if (params.arrangement === 'voronoi' && params.shape !== 'cellular') {
          // We place points at voronoi cell centers
          const cellJitter = params.jitterPos * 0.9 + 0.1;
          const h = NoiseUtils.hash2(col, row, params.seed);
          const px = ((h & 0xffff) / 0xffff) - 0.5;
          const py = (((h >> 16) & 0xffff) / 0xffff) - 0.5;
          lx += px * spacingX * cellJitter;
          ly += py * spacingY * cellJitter;
        } else {
          // Standard Array (Grid)
          if (params.jitterPos > 0) {
            lx += (rng() - 0.5) * spacingX * params.jitterPos;
            ly += (rng() - 0.5) * spacingY * params.jitterPos;
          }
        }

        // Apply Global Transform
        let gx = lx * cosR - ly * sinR + oX;
        let gy = lx * sinR + ly * cosR + oY;

        // Skip shapes far outside canvas to save performance
        if (gx < -baseSize*2 || gx > width+baseSize*2 || gy < -baseSize*2 || gy > height+baseSize*2) {
          continue;
        }

        // Select Shape Type
        let typeListUrl = null;
        if (params.shape === 'symbol') {
          if (params.symbolType && params.symbolType !== 'random') {
            typeListUrl = params.symbolType;
          } else {
            typeListUrl = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
          }
        } else if (params.shape === 'geometric') {
          if (params.symbolType && params.symbolType !== 'random') {
            typeListUrl = params.symbolType;
          } else {
            typeListUrl = GEOMETRIC[Math.floor(rng() * GEOMETRIC.length)];
          }
        }

        // Instance Transforms (Jitters)
        const rotation = (params.jitterRot > 0) ? ((rng() - 0.5) * 2 * params.jitterRot) : 0;
        let sizeVar = baseSize;
        if (params.jitterScale > 0) {
          sizeVar *= (1.0 + (rng() - 0.5) * params.jitterScale * 1.5);
        }

        drawShape(ctx, params.shape, typeListUrl, gx, gy, sizeVar, rotation, color, window.currentCustomImage, params.customSvgPath);
      }
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    pixels.set(imageData.data);
  }


  function applyMask(pixels, width, height, params) {
    if (!params.maskEnable || !window.currentMaskImage) return;

    // Draw mask to an offscreen canvas to sample pixels
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext('2d');
    
    // Stretch mask over the entire canvas
    ctx.drawImage(window.currentMaskImage, 0, 0, width, height);
    const maskData = ctx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < pixels.length; i += 4) {
      // Calculate grayscale brightness of mask [0, 1]
      let maskBrightness = (maskData[i] + maskData[i + 1] + maskData[i + 2]) / (3 * 255);
      
      if (params.maskInvert) {
        maskBrightness = 1.0 - maskBrightness;
      }

      // Multiply existing procedural pixel by mask brightness
      const pR = pixels[i];
      const pG = pixels[i + 1];
      const pB = pixels[i + 2];

      pixels[i] = Math.min(255, Math.max(0, pR * maskBrightness));
      pixels[i + 1] = Math.min(255, Math.max(0, pG * maskBrightness));
      pixels[i + 2] = Math.min(255, Math.max(0, pB * maskBrightness));
    }
  }

  // --- Main Generate Entry ---
  function generateHeightMap(pixels, width, height, params) {
    if (params.shape === 'cellular') {
      renderCellular(pixels, width, height, params);
    } else {
      renderStamped(pixels, width, height, params);
    }
    
    // Apply Global Mask if enabled
    applyMask(pixels, width, height, params);
  }

  return { generateHeightMap };
})();
