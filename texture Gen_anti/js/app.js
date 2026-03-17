/**
 * app.js — Main application controller V2
 */

(function () {
  'use strict';

  // ─── Canvas Setup ─────────────────────────────────────────
  const canvas = document.getElementById('texture-canvas');
  const ctx = canvas.getContext('2d');
  const CANVAS_SIZE = 1024;
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  let heightImageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);
  let normalImageData = ctx.createImageData(CANVAS_SIZE, CANVAS_SIZE);

  window.currentCustomImage = null; // Pattern Instance
  window.currentMaskImage = null;   // Global Mask

  // ─── State ────────────────────────────────────────────────
  let currentTab = 'heightmap';
  const defaultParams = {
    arrangement: 'voronoi',
    shape: 'symbol',
    symbolType: 'star',
    tileX: 10,
    tileY: 10,
    globalRot: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 0.5,
    jitterPos: 0.2,
    jitterRot: 0,
    jitterScale: 0.1,
    heightStrength: 0.5,
    seed: 42,
    maskEnable: false,
    maskInvert: false,
    bgColor: '#000000',
    customSvgPath: ''
  };
  let params = { ...defaultParams };
  let renderPending = false;
  
  let viewState = { zoom: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };

  // ─── DOM References ───────────────────────────────────────
  const els = {
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    arrSel: document.getElementById('arrangement-select'),
    shapeSel: document.getElementById('shape-select'),
    symbolTypeGroup: document.getElementById('symbol-type-group'),
    symbolTypeSel: document.getElementById('symbol-type-select'),
    customSvgGroup: document.getElementById('custom-svg-group'),
    customSvgInput: document.getElementById('custom-svg-input'),
    imgGroup: document.getElementById('image-upload-group'),
    imgInput: document.getElementById('image-upload'),
    
    maskDropZone: document.getElementById('mask-drop-zone'),
    maskInput: document.getElementById('mask-upload'),
    clearMaskBtn: document.getElementById('clear-mask-btn'),
    maskEnable: document.getElementById('mask-enable'),
    maskInvert: document.getElementById('mask-invert'),
    
    bgColorIn: document.getElementById('bg-color-input'),
    bgColorHex: document.getElementById('bg-color-hex'),
    
    previewPanel: document.getElementById('preview-panel'),
    canvasWrapper: document.getElementById('canvas-wrapper'),
    canvas3DWrapper: document.getElementById('canvas-wrapper-3d'),
    resetBtn: document.getElementById('reset-view-btn'),
    patternSummary: document.getElementById('pattern-summary'),
    
    tileXSl: document.getElementById('tile-x-slider'), tileXIn: document.getElementById('tile-x-input'),
    tileYSl: document.getElementById('tile-y-slider'), tileYIn: document.getElementById('tile-y-input'),
    gRotSl: document.getElementById('global-rot-slider'), gRotIn: document.getElementById('global-rot-input'),
    offXSl: document.getElementById('offset-x-slider'), offXIn: document.getElementById('offset-x-input'),
    offYSl: document.getElementById('offset-y-slider'), offYIn: document.getElementById('offset-y-input'),
    
    scaleSl: document.getElementById('scale-slider'), scaleIn: document.getElementById('scale-input'),
    jPosSl: document.getElementById('jitter-pos-slider'), jPosIn: document.getElementById('jitter-pos-input'),
    jRotSl: document.getElementById('jitter-rot-slider'), jRotIn: document.getElementById('jitter-rot-input'),
    jScaSl: document.getElementById('jitter-scale-slider'), jScaIn: document.getElementById('jitter-scale-input'),
    
    heightSl: document.getElementById('height-slider'), heightIn: document.getElementById('height-input'),
    seedSl: document.getElementById('seed-slider'), seedIn: document.getElementById('seed-input'),
    seedBtn: document.getElementById('random-seed-btn'),
    
    tabH: document.getElementById('tab-heightmap'),
    tabN: document.getElementById('tab-normalmap'),
    tab3D: document.getElementById('tab-3d'),
    expBtn: document.getElementById('export-btn'),
    resSel: document.getElementById('resolution-select'),
    expTypeSel: document.getElementById('export-type-select')
  };

  // ─── Render Pipeline ─────────────────────────────────────
  function scheduleRender() {
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(doRender);
    }
  }

  function doRender() {
    renderPending = false;
    updatePatternSummary();
    
    // We pass radians to engine for rotations
    const renderParams = { ...params };
    renderParams.globalRot = params.globalRot * (Math.PI / 180);
    renderParams.jitterRot = params.jitterRot * (Math.PI / 180);

    window.TextureEngine.generateHeightMap(heightImageData.data, CANVAS_SIZE, CANVAS_SIZE, renderParams);

    if (currentTab === 'normalmap') {
      window.NormalMapConverter.convert(
        heightImageData.data,
        normalImageData.data,
        CANVAS_SIZE, CANVAS_SIZE,
        params.heightStrength
      );
      ctx.putImageData(normalImageData, 0, 0);
    } else if (currentTab === 'heightmap') {
      ctx.putImageData(heightImageData, 0, 0);
    } else if (currentTab === '3d') {
      // 3D Preview: Ensure Normal Map is calculated for material
      window.NormalMapConverter.convert(
        heightImageData.data,
        normalImageData.data,
        CANVAS_SIZE, CANVAS_SIZE,
        params.heightStrength
      );
      if (window.Preview3D) {
        window.Preview3D.updateTextures(heightImageData.data, normalImageData.data, CANVAS_SIZE, CANVAS_SIZE, params.heightStrength);
      }
    }
  }

  // ─── Sync Helper ─────────────────────────────────────────
  function bindSync(sliderId, inputId, paramKey, isFloat) {
    const sl = els[sliderId];
    const inp = els[inputId];
    if (!sl || !inp) return;
    
    const update = (val) => {
      let num = isFloat ? parseFloat(val) : parseInt(val, 10);
      // Clamp to min/max
      const min = isFloat ? parseFloat(sl.min) : parseInt(sl.min, 10);
      const max = isFloat ? parseFloat(sl.max) : parseInt(sl.max, 10);
      num = Math.max(min, Math.min(max, num));
      
      params[paramKey] = num;
      sl.value = num;
      inp.value = num;
      scheduleRender();
    };

    sl.addEventListener('input', (e) => update(e.target.value));
    inp.addEventListener('change', (e) => update(e.target.value));
    // Provide live update on typing numbers
    inp.addEventListener('input', (e) => {
      let num = parseFloat(e.target.value);
      if (!isNaN(num)) {
        params[paramKey] = num;
        sl.value = num;
        scheduleRender();
      }
    });

    // Init UI from params
    sl.value = params[paramKey];
    inp.value = params[paramKey];
    
    // Store original update function for reset support if desired,
    // or we can just push direct values during reset.
  }
  
  function updatePatternSummary() {
    const arrNames = { array: 'Array Grid', scatter: 'Scatter', voronoi: 'Voronoi' };
    const shapeNames = { symbol: 'Symbol', geometric: 'Geometric', cellular: 'Cellular', image: 'Custom Image' };
    
    let str = `${arrNames[params.arrangement]} + `;
    
    if (params.shape === 'image') {
      str += 'Custom Image';
    } else {
      const typeStr = params.symbolType === 'random' ? 'Random Selected' : (params.symbolType || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      str += `${typeStr} ${shapeNames[params.shape]}`;
    }
    
    if (els.patternSummary) {
      els.patternSummary.textContent = str;
    }
  }

  const SUBTYPES = {
    symbol: [
      { v: 'random', l: 'Random Selected' },
      { v: 'star', l: 'Star ★' },
      { v: 'circle', l: 'Circle ○' },
      { v: 'triangle', l: 'Triangle △' },
      { v: 'square', l: 'Square □' },
      { v: 'cross', l: 'Cross ×' },
      { v: 'arrow', l: 'Arrow ➔' },
      { v: 'wave_line', l: 'Wave Line 〰' },
      { v: 'custom_glyph', l: 'Custom Glyph (SVG)' }
    ],
    geometric: [
      { v: 'solid_circle', l: 'Solid Circle ●' },
      { v: 'solid_square', l: 'Solid Square ■' },
      { v: 'octagon', l: 'Octagon' },
      { v: 'pentagon', l: 'Pentagon' },
      { v: 'cross_plus', l: 'Cross / Plus' },
      { v: 'l_shape', l: 'L-Shape' },
      { v: 't_shape', l: 'T-Shape' },
      { v: 'gear', l: 'Gear' },
      { v: 'pinwheel', l: 'Pinwheel' }
    ],
    cellular: [
      { v: 'f2_minus_f1', l: 'Worley F2-F1' },
      { v: 'cracked', l: 'Cracked' },
      { v: 'foam', l: 'Foam' }
    ]
  };

  function updateSubtypeOptions() {
    if (!els.symbolTypeSel) return;
    
    const types = SUBTYPES[params.shape] || [];
    els.symbolTypeSel.innerHTML = '';
    
    types.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.v;
      option.textContent = opt.l;
      els.symbolTypeSel.appendChild(option);
    });
    
    if (types.length > 0) {
      params.symbolType = types[0].v;
      els.symbolTypeSel.value = types[0].v;
      if (els.symbolTypeGroup) els.symbolTypeGroup.style.display = 'block';
    } else {
      params.symbolType = '';
      if (els.symbolTypeGroup) els.symbolTypeGroup.style.display = 'none';
      if (els.customSvgGroup) els.customSvgGroup.style.display = 'none';
    }
    
    updateCustomSvgVisibility();
  }
  
  function updateCustomSvgVisibility() {
    if (params.shape === 'symbol' && params.symbolType === 'custom_glyph') {
      if (els.customSvgGroup) els.customSvgGroup.style.display = 'block';
    } else {
      if (els.customSvgGroup) els.customSvgGroup.style.display = 'none';
    }
  }

  // ─── UI Event Bindings ────────────────────────────────────
  els.arrSel.addEventListener('change', (e) => {
    params.arrangement = e.target.value;
    scheduleRender();
  });

  els.shapeSel.addEventListener('change', (e) => {
    params.shape = e.target.value;
    
    if (params.shape === 'image') {
      els.imgGroup.style.display = 'block';
    } else {
      els.imgGroup.style.display = 'none';
    }
    
    updateSubtypeOptions();
    scheduleRender();
  });

  if (els.symbolTypeSel) {
    els.symbolTypeSel.addEventListener('change', (e) => {
      params.symbolType = e.target.value;
      updateCustomSvgVisibility();
      scheduleRender();
    });
  }
  
  if (els.customSvgInput) {
    els.customSvgInput.addEventListener('input', (e) => {
      params.customSvgPath = e.target.value;
      scheduleRender();
    });
  }

  els.imgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        window.currentCustomImage = img;
        scheduleRender();
      };
      img.src = URL.createObjectURL(file);
    }
  });

  // Mask Dropzone Logic
  function handleMaskFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => {
      window.currentMaskImage = img;
      scheduleRender();
      if (els.maskDropZone) {
        const textEl = els.maskDropZone.querySelector('.drop-zone-text');
        if (textEl) textEl.innerHTML = `Mask loaded:<br><b>${file.name}</b>`;
        els.maskDropZone.style.borderColor = 'var(--success)';
      }
      if (els.clearMaskBtn) els.clearMaskBtn.style.display = 'flex';
    };
    img.src = URL.createObjectURL(file);
  }

  if (els.clearMaskBtn) {
    els.clearMaskBtn.addEventListener('click', () => {
      window.currentMaskImage = null;
      if (els.maskInput) els.maskInput.value = '';
      if (els.maskDropZone) {
        const textEl = els.maskDropZone.querySelector('.drop-zone-text');
        if (textEl) textEl.innerHTML = `Drag & Drop Image Here<br>or click to browse`;
        els.maskDropZone.style.borderColor = '';
      }
      els.clearMaskBtn.style.display = 'none';
      scheduleRender();
    });
  }

  if (els.maskDropZone) {
    els.maskDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.maskDropZone.classList.add('dragover');
    });
    els.maskDropZone.addEventListener('dragleave', () => {
      els.maskDropZone.classList.remove('dragover');
    });
    els.maskDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.maskDropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleMaskFile(e.dataTransfer.files[0]);
      }
    });
  }

  els.maskInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleMaskFile(e.target.files[0]);
    }
  });

  els.maskEnable.addEventListener('change', (e) => {
    params.maskEnable = e.target.checked;
    scheduleRender();
  });

  els.maskInvert.addEventListener('change', (e) => {
    params.maskInvert = e.target.checked;
    scheduleRender();
  });
  
  // Background Color affects Preview Panel
  if (els.bgColorIn) {
    els.bgColorIn.addEventListener('input', (e) => {
      params.bgColor = e.target.value;
      if (els.bgColorHex) els.bgColorHex.textContent = e.target.value.toUpperCase();
      if (els.previewPanel) els.previewPanel.style.backgroundColor = params.bgColor;
      if (window.Preview3D) window.Preview3D.updateBaseColor(params.bgColor);
    });
    
    // Init bgColor
    if (els.previewPanel) els.previewPanel.style.backgroundColor = params.bgColor;
  }
  
  // Reset Settings Logic
  if (els.resetSettingsBtn) {
    els.resetSettingsBtn.addEventListener('click', () => {
      params = { ...defaultParams };
      
      // Update DOM values directly
      els.arrSel.value = params.arrangement;
      els.shapeSel.value = params.shape;
      
      els.tileXSl.value = params.tileX; els.tileXIn.value = params.tileX;
      els.tileYSl.value = params.tileY; els.tileYIn.value = params.tileY;
      els.gRotSl.value = params.globalRot; els.gRotIn.value = params.globalRot;
      els.offXSl.value = params.offsetX; els.offXIn.value = params.offsetX;
      els.offYSl.value = params.offsetY; els.offYIn.value = params.offsetY;
      els.scaleSl.value = params.scale; els.scaleIn.value = params.scale;
      els.jPosSl.value = params.jitterPos; els.jPosIn.value = params.jitterPos;
      els.jRotSl.value = params.jitterRot; els.jRotIn.value = params.jitterRot;
      els.jScaSl.value = params.jitterScale; els.jScaIn.value = params.jitterScale;
      els.heightSl.value = params.heightStrength; els.heightIn.value = params.heightStrength;
      els.seedSl.value = params.seed; els.seedIn.value = params.seed;
      
      els.maskEnable.checked = params.maskEnable;
      els.maskInvert.checked = params.maskInvert;
      
      if (els.bgColorIn) els.bgColorIn.value = params.bgColor;
      if (els.bgColorHex) els.bgColorHex.textContent = params.bgColor.toUpperCase();
      if (els.previewPanel) els.previewPanel.style.backgroundColor = params.bgColor;
      if (window.Preview3D) window.Preview3D.updateBaseColor(params.bgColor);
      
      if (els.customSvgInput) els.customSvgInput.value = params.customSvgPath;
      
      window.currentCustomImage = null;
      window.currentMaskImage = null;
      
      if (els.maskDropZone) els.maskDropZone.querySelector('.drop-zone-text').innerHTML = `Drag & Drop Image Here<br>or click to browse`;
      if (els.clearMaskBtn) els.clearMaskBtn.style.display = 'none';
      if (els.imgGroup) els.imgGroup.style.display = 'none';

      updateSubtypeOptions();
      
      viewState = { zoom: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
      updateCanvasTransform();
      
      scheduleRender();
    });
  }

  // Bind all parameters
  bindSync('tileXSl', 'tileXIn', 'tileX', false);
  bindSync('tileYSl', 'tileYIn', 'tileY', false);
  bindSync('gRotSl', 'gRotIn', 'globalRot', false);
  bindSync('offXSl', 'offXIn', 'offsetX', true);
  bindSync('offYSl', 'offYIn', 'offsetY', true);
  
  bindSync('scaleSl', 'scaleIn', 'scale', true);
  bindSync('jPosSl', 'jPosIn', 'jitterPos', true);
  bindSync('jRotSl', 'jRotIn', 'jitterRot', false);
  bindSync('jScaSl', 'jScaIn', 'jitterScale', true);
  
  bindSync('heightSl', 'heightIn', 'heightStrength', true);
  bindSync('seedSl', 'seedIn', 'seed', false);

  els.seedBtn.addEventListener('click', () => {
    const newSeed = Math.floor(Math.random() * 9999);
    params.seed = newSeed;
    els.seedSl.value = newSeed;
    els.seedIn.value = newSeed;
    scheduleRender();
  });

  // Tabs
  els.tabH.addEventListener('click', () => {
    currentTab = 'heightmap';
    els.tabH.classList.add('active');
    els.tabN.classList.remove('active');
    if (els.tab3D) els.tab3D.classList.remove('active');
    
    els.canvasWrapper.style.display = 'block';
    if (els.canvas3DWrapper) els.canvas3DWrapper.style.display = 'none';
    if (window.Preview3D) window.Preview3D.stop();
    scheduleRender();
  });

  els.tabN.addEventListener('click', () => {
    currentTab = 'normalmap';
    els.tabN.classList.add('active');
    els.tabH.classList.remove('active');
    if (els.tab3D) els.tab3D.classList.remove('active');
    
    els.canvasWrapper.style.display = 'block';
    if (els.canvas3DWrapper) els.canvas3DWrapper.style.display = 'none';
    if (window.Preview3D) window.Preview3D.stop();
    scheduleRender();
  });
  
  if (els.tab3D) {
    els.tab3D.addEventListener('click', () => {
      currentTab = '3d';
      els.tab3D.classList.add('active');
      els.tabH.classList.remove('active');
      els.tabN.classList.remove('active');
      
      els.canvasWrapper.style.display = 'none';
      if (els.canvas3DWrapper) els.canvas3DWrapper.style.display = 'block';
      if (window.Preview3D) {
        window.Preview3D.start();
        window.Preview3D.updateBaseColor(params.bgColor);
      }
      scheduleRender();
    });
  }
  
  // Canvas Zoom / Pan Logic
  function updateCanvasTransform() {
    canvas.style.transform = `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`;
  }

  if (els.canvasWrapper) {
    els.canvasWrapper.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSensitivity = -0.001;
      let newZoom = viewState.zoom * Math.exp(e.deltaY * zoomSensitivity);
      viewState.zoom = Math.max(0.1, Math.min(10, newZoom));
      updateCanvasTransform();
    });

    els.canvasWrapper.addEventListener('mousedown', (e) => {
      viewState.isDragging = true;
      viewState.startX = e.clientX - viewState.panX;
      viewState.startY = e.clientY - viewState.panY;
      els.canvasWrapper.style.cursor = 'grabbing';
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (!viewState.isDragging) return;
    viewState.panX = e.clientX - viewState.startX;
    viewState.panY = e.clientY - viewState.startY;
    updateCanvasTransform();
  });

  window.addEventListener('mouseup', () => {
    if (viewState.isDragging) {
      viewState.isDragging = false;
      if (els.canvasWrapper) els.canvasWrapper.style.cursor = '';
    }
  });

  if (els.resetBtn) {
    els.resetBtn.addEventListener('click', () => {
      viewState = { zoom: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
      updateCanvasTransform();
    });
  }

  // Export
  els.expBtn.addEventListener('click', () => {
    const resolution = parseInt(els.resSel.value);
    const mapType = els.expTypeSel.value;
    
    els.expBtn.classList.add('exporting');
    els.expBtn.textContent = 'Exporting...';
    
    setTimeout(() => {
      // Pass radians to export
      const exportParams = { ...params };
      exportParams.globalRot = params.globalRot * (Math.PI / 180);
      exportParams.jitterRot = params.jitterRot * (Math.PI / 180);

      window.TextureExporter.exportPNG({
        mapType,
        resolution,
        params: exportParams
      });
      
      setTimeout(() => {
        els.expBtn.classList.remove('exporting');
        els.expBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export PNG
        `;
      }, 600);
    }, 50);
  });

  // ─── Initial Render ───────────────────────────────────────
  updateSubtypeOptions(); // Init options correctly based on default "shape"
  scheduleRender();

})();
