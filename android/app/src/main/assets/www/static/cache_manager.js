/**
 * Clipify AI - Storage & Cache Manager
 * Handles clearing Whisper transcriptions, temporary cache files,
 * and imported YouTube media footage saved on the system.
 */
(function () {
  let modalEl = null;
  let cacheState = {
    totalBytes: 0,
    totalFormatted: '0 B',
    ytCount: 0,
    ytBytes: 0,
    ytFormatted: '0 B',
    cacheCount: 0,
    cacheBytes: 0,
    cacheFormatted: '0 B'
  };

  async function fetchCacheStatus() {
    try {
      const res = await fetch('/api/cache/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;

      cacheState = {
        totalBytes: data.total_bytes || 0,
        totalFormatted: data.total_formatted || '0 B',
        ytCount: data.yt_count || 0,
        ytBytes: data.yt_bytes || 0,
        ytFormatted: data.yt_formatted || '0 B',
        cacheCount: data.cache_count || 0,
        cacheBytes: data.cache_bytes || 0,
        cacheFormatted: data.cache_formatted || '0 B'
      };

      updateNavBadge();
    } catch (_) { }
  }

  function updateNavBadge() {
    const pills = document.querySelectorAll('.nav-cache-pill');
    pills.forEach(pill => {
      if (cacheState.totalBytes > 0) {
        pill.textContent = cacheState.totalFormatted;
        pill.style.display = 'inline-block';
      } else {
        pill.style.display = 'none';
      }
    });
  }

  function initModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'clearCacheModalOverlay';
    modalEl.className = 'cache-modal-overlay';
    modalEl.innerHTML = `
      <div class="cache-modal-card" id="clearCacheModalCard" role="dialog" aria-modal="true" aria-labelledby="cacheModalTitle">
        <div class="cache-modal-header">
          <div class="cache-modal-title-row">
            <div class="cache-modal-icon-badge">🧹</div>
            <div>
              <h3 class="cache-modal-title" id="cacheModalTitle">Clear Cache & Temporary Media</h3>
              <p class="cache-modal-subtitle">Reclaim local storage & remove downloaded video footage</p>
            </div>
          </div>
          <button type="button" class="cache-modal-close" aria-label="Close modal">&times;</button>
        </div>

        <div class="cache-modal-body" id="cacheModalBody">
          <div class="cache-storage-hero">
            <div class="cache-storage-info">
              <span class="cache-storage-label">Space to Reclaim</span>
              <span class="cache-storage-amount" id="cacheModalTotalHero">${cacheState.totalFormatted}</span>
              <span class="cache-storage-desc" id="cacheModalSubHero">Stored locally on your PC across jobs & cache</span>
            </div>
          </div>

          <div class="cache-items-list">
            <div class="cache-breakdown-row">
              <div class="cache-row-left">
                <span class="cache-row-icon">🎬</span>
                <div>
                  <div class="cache-row-title">Imported YouTube Footage</div>
                  <div class="cache-row-sub" id="cacheModalYtDetail">${cacheState.ytCount} video file(s) downloaded via YouTube links</div>
                </div>
              </div>
              <span class="cache-row-badge" id="cacheModalYtBadge">${cacheState.ytFormatted}</span>
            </div>

            <div class="cache-breakdown-row">
              <div class="cache-row-left">
                <span class="cache-row-icon">⚡</span>
                <div>
                  <div class="cache-row-title">Transcription & AI Cache</div>
                  <div class="cache-row-sub" id="cacheModalPklDetail">${cacheState.cacheCount} Whisper transcriptions & temporary chunks</div>
                </div>
              </div>
              <span class="cache-row-badge" id="cacheModalPklBadge">${cacheState.cacheFormatted}</span>
            </div>
          </div>

          <div class="cache-safety-badge">
            <span class="cache-safety-icon">🛡️</span>
            <div>
              <strong>100% Safe:</strong> Your exported final Shorts in the <b>Output folder & Editor</b> are permanently saved and will <b>never</b> be touched.
            </div>
          </div>
        </div>

        <div class="cache-modal-footer" id="cacheModalFooter">
          <button type="button" class="cache-btn-cancel">Cancel</button>
          <button type="button" class="cache-btn-action" id="cacheBtnConfirm">
            <span>🧹 Clear Cache & Free Space</span>
          </button>
        </div>
      </div>
    `;

    // Event handlers
    modalEl.querySelector('.cache-modal-close').addEventListener('click', closeCacheModal);
    modalEl.querySelector('.cache-btn-cancel').addEventListener('click', closeCacheModal);
    modalEl.querySelector('#cacheBtnConfirm').addEventListener('click', executeClearCache);

    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeCacheModal();
    });

    document.body.appendChild(modalEl);
  }

  function updateModalValues() {
    if (!modalEl) return;
    const hero = modalEl.querySelector('#cacheModalTotalHero');
    const ytBadge = modalEl.querySelector('#cacheModalYtBadge');
    const ytDetail = modalEl.querySelector('#cacheModalYtDetail');
    const pklBadge = modalEl.querySelector('#cacheModalPklBadge');
    const pklDetail = modalEl.querySelector('#cacheModalPklDetail');

    if (hero) hero.textContent = cacheState.totalFormatted;
    if (ytBadge) ytBadge.textContent = cacheState.ytFormatted;
    if (ytDetail) ytDetail.textContent = `${cacheState.ytCount} video file(s) downloaded via YouTube links`;
    if (pklBadge) pklBadge.textContent = cacheState.cacheFormatted;
    if (pklDetail) pklDetail.textContent = `${cacheState.cacheCount} Whisper transcriptions & temporary chunks`;
  }

  async function showCacheModal() {
    initModal();
    await fetchCacheStatus();
    updateModalValues();

    // Reset body to confirmation view if it was previously showing success
    resetModalView();

    modalEl.style.display = 'flex';
    requestAnimationFrame(() => {
      modalEl.classList.add('active');
    });
  }

  function closeCacheModal() {
    if (!modalEl) return;
    modalEl.classList.remove('active');
    setTimeout(() => {
      modalEl.style.display = 'none';
      if (window.location.hash.toLowerCase() === '#cache') {
        history.replaceState(null, '', window.location.pathname);
      }
    }, 250);
  }

  function resetModalView() {
    if (!modalEl) return;
    const body = modalEl.querySelector('#cacheModalBody');
    const footer = modalEl.querySelector('#cacheModalFooter');

    body.innerHTML = `
      <div class="cache-storage-hero">
        <div class="cache-storage-info">
          <span class="cache-storage-label">Space to Reclaim</span>
          <span class="cache-storage-amount" id="cacheModalTotalHero">${cacheState.totalFormatted}</span>
          <span class="cache-storage-desc">Stored locally on your PC across jobs & cache</span>
        </div>
      </div>

      <div class="cache-items-list">
        <div class="cache-breakdown-row">
          <div class="cache-row-left">
            <span class="cache-row-icon">🎬</span>
            <div>
              <div class="cache-row-title">Imported YouTube Footage</div>
              <div class="cache-row-sub" id="cacheModalYtDetail">${cacheState.ytCount} video file(s) downloaded via YouTube links</div>
            </div>
          </div>
          <span class="cache-row-badge" id="cacheModalYtBadge">${cacheState.ytFormatted}</span>
        </div>

        <div class="cache-breakdown-row">
          <div class="cache-row-left">
            <span class="cache-row-icon">⚡</span>
            <div>
              <div class="cache-row-title">Transcription & AI Cache</div>
              <div class="cache-row-sub" id="cacheModalPklDetail">${cacheState.cacheCount} Whisper transcriptions & temporary chunks</div>
            </div>
          </div>
          <span class="cache-row-badge" id="cacheModalPklBadge">${cacheState.cacheFormatted}</span>
        </div>
      </div>

      <div class="cache-safety-badge">
        <span class="cache-safety-icon">🛡️</span>
        <div>
          <strong>100% Safe:</strong> Your exported final Shorts in the <b>Output folder & Editor</b> are permanently saved and will <b>never</b> be touched.
        </div>
      </div>
    `;

    footer.innerHTML = `
      <button type="button" class="cache-btn-cancel">Cancel</button>
      <button type="button" class="cache-btn-action" id="cacheBtnConfirm">
        <span>🧹 Clear Cache & Free Space</span>
      </button>
    `;

    footer.querySelector('.cache-btn-cancel').addEventListener('click', closeCacheModal);
    footer.querySelector('#cacheBtnConfirm').addEventListener('click', executeClearCache);
  }

  async function executeClearCache() {
    const btn = modalEl.querySelector('#cacheBtnConfirm');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block;animation:spin 0.8s linear infinite;">↻</span> Clearing storage…`;

    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to clear cache');

      // Update state
      const freedFormatted = data.freed_formatted || '0 B';
      const ytCount = data.yt_removed || 0;
      const cacheCount = data.cache_removed || 0;

      cacheState.totalBytes = 0;
      cacheState.totalFormatted = '0 B';
      updateNavBadge();

      // Clear input fields on the page if present
      const ytInput = document.querySelector('#youtubeUrl');
      if (ytInput) ytInput.value = '';
      const betaYtInput = document.querySelector('#betaYtUrl');
      if (betaYtInput) betaYtInput.value = '';
      const clearSrcBtn = document.querySelector('#betaClearSource');
      if (clearSrcBtn) clearSrcBtn.click();

      // Show Success view
      const body = modalEl.querySelector('#cacheModalBody');
      const footer = modalEl.querySelector('#cacheModalFooter');

      body.innerHTML = `
        <div class="cache-success-view">
          <div class="cache-success-icon-badge">✓</div>
          <h3 class="cache-success-title">Storage Cleaned Successfully!</h3>
          <div class="cache-success-stat">${freedFormatted} Freed</div>
          <p class="cache-success-desc">
            Removed <b>${ytCount}</b> imported YouTube video file(s) and <b>${cacheCount}</b> cached transcription & preview artifact(s).
          </p>
        </div>
      `;

      footer.innerHTML = `
        <button type="button" class="cache-btn-action" style="background:#22c55e;border-color:#4ade80;" id="cacheBtnDone">
          Done
        </button>
      `;

      footer.querySelector('#cacheBtnDone').addEventListener('click', closeCacheModal);

    } catch (err) {
      alert('Error clearing cache: ' + (err.message || 'Unknown error'));
      btn.disabled = false;
      btn.innerHTML = `<span>🧹 Clear Cache & Free Space</span>`;
    }
  }

  function bindEvents() {
    // 1. Sidebar link
    document.querySelectorAll('#navClearCacheLink').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showCacheModal();
      });
    });

    // 2. Buttons in YouTube and Beta sections
    document.querySelectorAll('.btn-clear-cache-link').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        showCacheModal();
      });
    });

    // 3. Hash change (#cache)
    function checkHash() {
      const h = window.location.hash.toLowerCase();
      if (h === '#cache' || h === '#clear-cache') {
        setTimeout(showCacheModal, 120);
      }
    }
    window.addEventListener('hashchange', checkHash);
    checkHash();
  }

  // Startup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fetchCacheStatus();
      bindEvents();
    });
  } else {
    fetchCacheStatus();
    bindEvents();
  }

  window.openClearCacheModal = showCacheModal;
})();
