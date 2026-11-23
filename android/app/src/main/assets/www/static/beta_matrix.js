/**
 * Clipify AI - Interactive ASCII Dot Matrix Background for Beta Testing Lab
 * Features:
 * - Fluid grid of delicate, crisp matrix dots spanning the entire width (left and right)
 * - Random dots across the entire width highlight, cycle through ASCII symbols (!@#$% 0 1), and smoothly vanish back to dots
 * - "CLIPIFY" text emerges dynamically at random positions across the grid with shimmering ASCII glyphs
 * - Interactive mouse repulsion with smooth spring physics
 * - Auto-pauses when user leaves #beta to ensure 0% idle CPU overhead
 */
(function () {
  'use strict';

  // 5x7 ASCII bitmap definitions for the word "CLIPIFY"
  const GLYPHS = {
    'C': [
      " 1111",
      "1    ",
      "1    ",
      "1    ",
      "1    ",
      "1    ",
      " 1111"
    ],
    'L': [
      "1    ",
      "1    ",
      "1    ",
      "1    ",
      "1    ",
      "1    ",
      "11111"
    ],
    'I': [
      "11111",
      "  1  ",
      "  1  ",
      "  1  ",
      "  1  ",
      "  1  ",
      "11111"
    ],
    'P': [
      "1111 ",
      "1   1",
      "1   1",
      "1111 ",
      "1    ",
      "1    ",
      "1    "
    ],
    'F': [
      "11111",
      "1    ",
      "1    ",
      "1111 ",
      "1    ",
      "1    ",
      "1    "
    ],
    'Y': [
      "1   1",
      "1   1",
      " 1 1 ",
      "  1  ",
      "  1  ",
      "  1  ",
      "  1  "
    ]
  };

  const WORD = ['C', 'L', 'I', 'P', 'I', 'F', 'Y'];
  const ASCII_SYMBOLS = ['■', '◆', '▲', '▼', '●', '#', '%', '&', 'X', 'Q', 'G', '6', 'N', 'A', '8', '0', '$', '*', '+', 'W', 'M', 'K'];
  const GLITCH_SYMBOLS = ['!', '@', '#', '$', '%', '^', '&', '*', '0', '1', '7', '8', 'X', 'Q', '?', '~'];

  // Build 2D relative pixel map for "CLIPIFY" (letter width 5, gap 1)
  const WORD_MAP = [];
  let currentOffsetCol = 0;
  WORD.forEach((letter) => {
    const rows = GLYPHS[letter] || GLYPHS['C'];
    for (let r = 0; r < 7; r++) {
      const line = rows[r] || "     ";
      for (let c = 0; c < 5; c++) {
        if (line[c] === '1') {
          WORD_MAP.push({ relCol: currentOffsetCol + c, relRow: r });
        }
      }
    }
    currentOffsetCol += 6; // 5 cols + 1 col gap
  });
  const WORD_TOTAL_COLS = currentOffsetCol; // ~42 cols
  const WORD_TOTAL_ROWS = 7;

  let canvas = null;
  let ctx = null;
  let betaSection = null;
  let animId = null;
  let running = false;

  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  const SPACING = 16; // Balanced matrix spacing

  let grid = [];
  let mouse = { x: -9999, y: -9999, active: false };

  // Text animation state
  let textState = {
    startCol: 4,
    startRow: 4,
    alpha: 0,
    targetAlpha: 1,
    phase: 'fadeIn', // 'fadeIn', 'hold', 'fadeOut'
    timer: 0,
    holdDuration: 4.0,
    fadeSpeed: 1.1,
    charOverrides: {}
  };

  // Dynamic glitching symbol nodes
  let glitches = [];

  function pickRandomPosition() {
    const maxCol = Math.max(2, cols - WORD_TOTAL_COLS - 2);
    const maxRow = Math.max(2, rows - WORD_TOTAL_ROWS - 2);
    textState.startCol = Math.floor(2 + Math.random() * maxCol);
    textState.startRow = Math.floor(2 + Math.random() * maxRow);
    textState.alpha = 0;
    textState.phase = 'fadeIn';
    textState.timer = 0;

    // Randomize initial ASCII symbol assignments
    textState.charOverrides = {};
    WORD_MAP.forEach((pt, idx) => {
      textState.charOverrides[idx] = ASCII_SYMBOLS[Math.floor(Math.random() * ASCII_SYMBOLS.length)];
    });
  }

  function resize() {
    if (!canvas || !betaSection) return;
    const parent = betaSection.parentElement || document.body;
    width = canvas.width = Math.max(window.innerWidth, betaSection.offsetWidth || 0, betaSection.scrollWidth || 0, parent.clientWidth || 0);
    height = canvas.height = Math.max(window.innerHeight, betaSection.offsetHeight || 0, betaSection.scrollHeight || 0, 800);

    cols = Math.floor(width / SPACING);
    rows = Math.floor(height / SPACING);

    // Initialize full point grid spanning entire width & height
    grid = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = c * SPACING + SPACING / 2;
        const by = r * SPACING + SPACING / 2;
        grid.push({
          col: c,
          row: r,
          baseX: bx,
          baseY: by,
          x: bx,
          y: by,
          vx: 0,
          vy: 0
        });
      }
    }

    glitches = [];
    pickRandomPosition();
  }

  function updateGlitches(dt) {
    // Spawn new glitches across the entire width
    if (glitches.length < 40 && Math.random() < 0.35) {
      const randCol = Math.floor(Math.random() * cols);
      const randRow = Math.floor(Math.random() * rows);
      const key = `${randCol},${randRow}`;
      if (!glitches.some(g => g.key === key)) {
        glitches.push({
          key: key,
          col: randCol,
          row: randRow,
          char: GLITCH_SYMBOLS[Math.floor(Math.random() * GLITCH_SYMBOLS.length)],
          alpha: 0,
          maxAlpha: 0.85 + Math.random() * 0.15,
          phase: 'in', // 'in', 'hold', 'out'
          timer: 0,
          life: 1.5 + Math.random() * 2.0,
          cycleTimer: 0,
          cycleInterval: 0.08 + Math.random() * 0.08
        });
      }
    }

    // Update active glitches
    for (let i = glitches.length - 1; i >= 0; i--) {
      const g = glitches[i];
      g.timer += dt;
      g.cycleTimer += dt;

      // Constantly switch between symbols like !@#$% 0 1
      if (g.cycleTimer >= g.cycleInterval) {
        g.cycleTimer = 0;
        g.char = GLITCH_SYMBOLS[Math.floor(Math.random() * GLITCH_SYMBOLS.length)];
      }

      if (g.phase === 'in') {
        g.alpha += dt * 3.0;
        if (g.alpha >= g.maxAlpha) {
          g.alpha = g.maxAlpha;
          g.phase = 'hold';
        }
      } else if (g.phase === 'hold') {
        if (g.timer >= g.life) {
          g.phase = 'out';
        }
      } else if (g.phase === 'out') {
        g.alpha -= dt * 2.0;
        if (g.alpha <= 0) {
          glitches.splice(i, 1);
        }
      }
    }
  }

  function render(time) {
    if (!running || !ctx) return;

    ctx.clearRect(0, 0, width, height);

    const dt = 0.016;
    textState.timer += dt;

    if (textState.phase === 'fadeIn') {
      textState.alpha += dt * textState.fadeSpeed;
      if (textState.alpha >= 1) {
        textState.alpha = 1;
        textState.phase = 'hold';
        textState.timer = 0;
      }
    } else if (textState.phase === 'hold') {
      if (textState.timer >= textState.holdDuration) {
        textState.phase = 'fadeOut';
        textState.timer = 0;
      }
    } else if (textState.phase === 'fadeOut') {
      textState.alpha -= dt * textState.fadeSpeed;
      if (textState.alpha <= 0) {
        textState.alpha = 0;
        pickRandomPosition();
      }
    }

    // Occasional symbol shimmer inside "CLIPIFY"
    if (Math.random() < 0.25) {
      const randIdx = Math.floor(Math.random() * WORD_MAP.length);
      textState.charOverrides[randIdx] = ASCII_SYMBOLS[Math.floor(Math.random() * ASCII_SYMBOLS.length)];
    }

    updateGlitches(dt);

    // Fast lookup maps
    const activeTextCoords = new Map();
    if (textState.alpha > 0.02) {
      WORD_MAP.forEach((pt, idx) => {
        const c = textState.startCol + pt.relCol;
        const r = textState.startRow + pt.relRow;
        if (c >= 0 && c < cols && r >= 0 && r < rows) {
          activeTextCoords.set(`${c},${r}`, {
            char: textState.charOverrides[idx] || '#',
            alpha: textState.alpha
          });
        }
      });
    }

    const activeGlitchMap = new Map();
    glitches.forEach((g) => {
      activeGlitchMap.set(g.key, g);
    });

    ctx.font = '10px "Courier New", monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const repelRadius = 90;
    const repelRadiusSq = repelRadius * repelRadius;

    // Physics step and rendering for every grid point across entire section
    for (let i = 0; i < grid.length; i++) {
      const pt = grid[i];

      // Mouse repulsion physics
      if (mouse.active) {
        const dx = pt.x - mouse.x;
        const dy = pt.y - mouse.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < repelRadiusSq && dSq > 0.001) {
          const dist = Math.sqrt(dSq);
          const force = (1 - dist / repelRadius) * 14;
          pt.vx += (dx / dist) * force * 0.45;
          pt.vy += (dy / dist) * force * 0.45;
        }
      }

      // Spring back to base position
      pt.vx += (pt.baseX - pt.x) * 0.12;
      pt.vy += (pt.baseY - pt.y) * 0.12;
      pt.vx *= 0.76;
      pt.vy *= 0.76;
      pt.x += pt.vx;
      pt.y += pt.vy;

      const coordKey = `${pt.col},${pt.row}`;
      const textChar = activeTextCoords.get(coordKey);
      const glitch = activeGlitchMap.get(coordKey);

      if (textChar) {
        // Render bright glowing ASCII symbol for "CLIPIFY"
        ctx.fillStyle = `rgba(240, 248, 255, ${textChar.alpha.toFixed(2)})`;
        ctx.shadowColor = 'rgba(160, 220, 255, 0.75)';
        ctx.shadowBlur = 5;
        ctx.fillText(textChar.char, pt.x, pt.y);
        ctx.shadowBlur = 0;
      } else if (glitch && glitch.alpha > 0.02) {
        // Render highlighted symbol switching between !@#$% 0 1
        ctx.fillStyle = `rgba(255, 255, 255, ${glitch.alpha.toFixed(2)})`;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowBlur = 6;
        ctx.fillText(glitch.char, pt.x, pt.y);
        ctx.shadowBlur = 0;
      } else {
        // Render delicate, clearly visible matrix background dot (bumped from 0.10 to 0.32)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    animId = requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    animId = requestAnimationFrame(render);
  }

  function stop() {
    running = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function init() {
    canvas = document.getElementById('betaMatrixCanvas');
    betaSection = document.getElementById('beta');
    if (!canvas || !betaSection) return;

    ctx = canvas.getContext('2d');

    // Track mouse coordinates over #beta
    betaSection.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    });

    betaSection.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    window.addEventListener('resize', () => {
      if (running) resize();
    });

    // Check visibility on navigation
    function checkVisibility() {
      const isVisible = betaSection.classList.contains('visible') ||
        (window.location.hash || '').toLowerCase().includes('beta');
      if (isVisible) {
        start();
      } else {
        stop();
      }
    }

    window.addEventListener('hashchange', checkVisibility);
    const observer = new MutationObserver(checkVisibility);
    observer.observe(betaSection, { attributes: true, attributeFilter: ['class', 'style'] });

    checkVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.initBetaMatrix = init;
})();
