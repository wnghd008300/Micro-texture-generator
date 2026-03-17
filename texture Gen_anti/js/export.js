/**
 * export.js — PNG export at 1024×1024 or 2048×2048 V2.
 */

const TextureExporter = (() => {
  function exportPNG({ mapType, resolution, params }) {
    const size = resolution;

    // Create offscreen canvas at target resolution
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const ctx = offCanvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    
    // Generate height map at target resolution
    window.TextureEngine.generateHeightMap(imageData.data, size, size, params);

    if (mapType === 'normalmap') {
      const normalData = ctx.createImageData(size, size);
      window.NormalMapConverter.convert(imageData.data, normalData.data, size, size, params.heightStrength);
      ctx.putImageData(normalData, 0, 0);
    } else {
      ctx.putImageData(imageData, 0, 0);
    }

    // Trigger download
    offCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const mapLabel = mapType === 'normalmap' ? 'NormalMap' : 'HeightMap';
      const arrShape = `${params.arrangement}_${params.shape}`;
      a.download = `texture_${arrShape}_${mapLabel}_${size}x${size}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return { exportPNG };
})();

window.TextureExporter = TextureExporter;
