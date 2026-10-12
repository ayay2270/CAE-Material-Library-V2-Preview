(() => {
  const state = {
    materials: [],
    filtered: [],
    selected: null,
  };

  const pages = document.querySelectorAll('.page');
  const navButtons = document.querySelectorAll('.nav[data-page]');
  const pageTitle = document.getElementById('page-title');

  const unitToKg = { ton: 1000, kg: 1, g: 0.001 };

  function bridgeAvailable() {
    return !!(window.pywebview && window.pywebview.api);
  }

  function openPage(name) {
    pages.forEach((page) => page.classList.toggle('active', page.id === 'page-' + name));
    navButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === name));
    pageTitle.textContent = name === 'density' ? 'Density Tuner' : 'Material Library';
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => openPage(button.dataset.page));
  });

  document.getElementById('back-materials').addEventListener('click', () => openPage('materials'));

  window.addEventListener('pywebviewready', async () => {
    document.getElementById('runtime-name').textContent = 'pywebview Desktop';
    document.getElementById('runtime-detail').textContent = 'Python bridge connected';
    document.getElementById('mode-pill').textContent = 'Desktop POC';
    document.querySelector('.dot').style.background = '#19a36a';
    await loadMaterials();
  });

  function formatNumber(value, digits = 4) {
    if (value === null || value === undefined || value === '') return '—';
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    if (Math.abs(number) !== 0 && (Math.abs(number) < 0.001 || Math.abs(number) >= 100000)) {
      return number.toExponential(3).replace(/e\+?/i, 'E');
    }
    return Number(number.toFixed(digits)).toString();
  }

  function formatDensity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toExponential(3).replace(/e\+?/i, 'E') : '—';
  }

  function calculateEtan(material) {
    const e = Number(material?.youngsModulus);
    const h = Number(material?.etan);
    if (!Number.isFinite(e) || !Number.isFinite(h) || e <= 0 || h <= 0) return null;
    return (e * h) / (e + h);
  }

  async function getMaterialPayload() {
    if (bridgeAvailable()) {
      return await window.pywebview.api.get_materials();
    }

    const response = await fetch('../../src/data/materials.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('materials.json HTTP ' + response.status);
    return await response.json();
  }

  async function loadMaterials() {
    const count = document.getElementById('material-count');
    count.textContent = 'Loading…';

    try {
      const payload = await getMaterialPayload();
      state.materials = Array.isArray(payload) ? payload : (payload.materials || []);
      buildCategoryOptions();
      applyFilters();

      if (!state.selected && state.materials.length) {
        const preferred = state.materials.find((item) => item.name === 'SGCC') || state.materials[0];
        selectMaterial(preferred.id);
      } else if (state.selected) {
        const refreshed = state.materials.find((item) => item.id === state.selected.id);
        if (refreshed) selectMaterial(refreshed.id);
      }

      count.textContent = state.materials.length + ' materials';
    } catch (error) {
      count.textContent = 'Load failed';
      document.getElementById('material-action-status').textContent =
        '無法讀取 materials.json：' + String(error);
    }
  }

  function buildCategoryOptions() {
    const select = document.getElementById('category-filter');
    const current = select.value;
    const categories = [...new Set(state.materials.map((item) => item.category).filter(Boolean))].sort();

    select.innerHTML = '<option value="">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
    if (categories.includes(current)) select.value = current;
  }

  function applyFilters() {
    const query = document.getElementById('material-search').value.trim().toLowerCase();
    const category = document.getElementById('category-filter').value;

    state.filtered = state.materials.filter((item) => {
      const matchesCategory = !category || item.category === category;
      const haystack = [item.name, item.category, item.source, item.notes].filter(Boolean).join(' ').toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesCategory && matchesQuery;
    });

    renderRows();
  }

  function renderRows() {
    const tbody = document.getElementById('material-rows');
    tbody.innerHTML = '';

    state.filtered.forEach((material) => {
      const row = document.createElement('tr');
      row.dataset.id = material.id;
      row.classList.toggle('selected', state.selected?.id === material.id);
      row.innerHTML = [
        '<td><b>' + escapeHtml(material.name || '—') + '</b></td>',
        '<td>' + escapeHtml(material.category || '—') + '</td>',
        '<td>' + formatDensity(material.density) + '</td>',
        '<td>' + formatNumber(material.youngsModulus, 2) + '</td>',
        '<td>' + formatNumber(material.poissonRatio, 3) + '</td>',
        '<td>' + formatNumber(material.etan, 2) + '</td>',
      ].join('');
      row.addEventListener('click', () => selectMaterial(material.id));
      tbody.appendChild(row);
    });

    document.getElementById('material-count').textContent =
      state.filtered.length === state.materials.length
        ? state.materials.length + ' materials'
        : state.filtered.length + ' / ' + state.materials.length + ' materials';
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function selectMaterial(id) {
    const material = state.materials.find((item) => item.id === id);
    if (!material) return;
    state.selected = material;

    renderRows();

    document.getElementById('detail-name').textContent = material.name || '—';
    document.getElementById('detail-category').textContent = material.category || '—';
    document.getElementById('detail-source').textContent = material.source || 'No source';
    document.getElementById('detail-density').textContent = formatDensity(material.density);
    document.getElementById('detail-e').textContent = formatNumber(material.youngsModulus, 2);
    document.getElementById('detail-pr').textContent = formatNumber(material.poissonRatio, 3);
    document.getElementById('detail-yield').textContent = formatNumber(material.yieldStress, 2);
    document.getElementById('detail-h').textContent = formatNumber(material.etan, 2);
    document.getElementById('detail-etan').textContent = formatNumber(calculateEtan(material), 2);
    document.getElementById('detail-notes').textContent = material.notes || 'No notes.';

    document.getElementById('action-material-name').textContent = material.name || '—';
    document.getElementById('action-material-density').textContent =
      'ρ = ' + formatDensity(material.density) + ' · E = ' + formatNumber(material.youngsModulus, 2) + ' MPa';

    syncDensityFromSelectedMaterial();
  }

  function syncDensityFromSelectedMaterial() {
    if (!state.selected) return;
    document.getElementById('density-material-name').textContent = state.selected.name || '—';
    document.getElementById('density-material-meta').textContent =
      (state.selected.category || 'Unknown') + ' · Source: ' + (state.selected.source || '—');
    document.getElementById('density-current').value = state.selected.density ?? '';
    calculateDensity();
  }

  document.getElementById('send-to-density').addEventListener('click', () => {
    syncDensityFromSelectedMaterial();
    openPage('density');
  });

  document.getElementById('material-search').addEventListener('input', applyFilters);
  document.getElementById('category-filter').addEventListener('change', applyFilters);
  document.getElementById('reload-db').addEventListener('click', loadMaterials);

  function parsePositive(value) {
    const number = Number(String(value).trim());
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function calculateDensity() {
    const currentDensity = parsePositive(document.getElementById('density-current').value);
    const currentMass = parsePositive(document.getElementById('density-current-mass').value);
    const targetMass = parsePositive(document.getElementById('density-target-mass').value);
    const quantity = parsePositive(document.getElementById('density-quantity').value);
    const currentUnit = document.getElementById('density-current-unit').value;
    const targetUnit = document.getElementById('density-target-unit').value;

    const resultEl = document.getElementById('density-result');

    if (
      currentDensity === null ||
      currentMass === null ||
      targetMass === null ||
      quantity === null ||
      !Number.isSafeInteger(quantity)
    ) {
      resultEl.textContent = 'Invalid input';
      return null;
    }

    const currentKg = currentMass * unitToKg[currentUnit];
    const targetKg = targetMass * quantity * unitToKg[targetUnit];
    const scaleFactor = targetKg / currentKg;
    const density = currentDensity * scaleFactor;
    const expectedMass =
      currentMass * (density / currentDensity) * (unitToKg[currentUnit] / unitToKg[targetUnit]);

    resultEl.textContent = formatDensity(density);
    document.getElementById('density-scale').textContent = scaleFactor.toFixed(5) + ' ×';
    document.getElementById('density-expected').textContent = expectedMass.toFixed(3) + ' ' + targetUnit;
    document.getElementById('density-total').textContent = (targetMass * quantity).toFixed(3) + ' ' + targetUnit;
    document.getElementById('density-before').textContent = formatDensity(currentDensity);
    document.getElementById('density-after').textContent = formatDensity(density);

    return { currentDensity, density, expectedMass, targetUnit, scaleFactor };
  }

  [
    'density-current',
    'density-quantity',
    'density-current-mass',
    'density-target-mass',
    'density-current-unit',
    'density-target-unit',
  ].forEach((id) => {
    document.getElementById(id).addEventListener('input', calculateDensity);
    document.getElementById(id).addEventListener('change', calculateDensity);
  });

  document.getElementById('recalculate').addEventListener('click', calculateDensity);

  document.getElementById('apply-material').addEventListener('click', async () => {
    const status = document.getElementById('material-action-status');
    if (!state.selected) {
      status.textContent = '請先選擇材料。';
      return;
    }

    const target = document.getElementById('target-entity').value.trim() || '(未指定 Target)';
    const solver = document.getElementById('solver-target').value;

    if (bridgeAvailable()) {
      try {
        const response = await window.pywebview.api.apply_material_dry_run(
          state.selected.id,
          target,
          solver,
        );
        status.textContent = response.message;
      } catch (error) {
        status.textContent = 'Dry Run 失敗：' + String(error);
      }
    } else {
      status.textContent =
        'Browser Preview：準備把 ' + state.selected.name + ' 套用至 ' + target + '（' + solver + '）。未修改 HyperMesh。';
    }
  });

  document.getElementById('apply-density').addEventListener('click', async () => {
    const status = document.getElementById('density-action-status');
    const result = calculateDensity();
    if (!result) {
      status.textContent = '輸入數值無效，沒有產生 Action Plan。';
      return;
    }

    const target = document.getElementById('density-target-entity').value.trim() || '(未指定 Target)';
    const materialId = state.selected?.id || '';

    if (bridgeAvailable()) {
      try {
        const response = await window.pywebview.api.apply_density_dry_run(
          materialId,
          target,
          result.density,
        );
        status.textContent = response.message;
      } catch (error) {
        status.textContent = 'Dry Run 失敗：' + String(error);
      }
    } else {
      status.textContent =
        'Browser Preview：Target ' + target + '，New Density = ' + formatDensity(result.density) + '。未修改 HyperMesh。';
    }
  });

  document.getElementById('open-db-folder').addEventListener('click', async () => {
    const status = document.getElementById('material-action-status');
    if (!bridgeAvailable()) {
      status.textContent = '這個動作只有 pywebview Desktop 模式可以使用。';
      return;
    }

    try {
      await window.pywebview.api.open_database_folder();
      status.textContent = '已要求開啟 materials.json 所在資料夾。';
    } catch (error) {
      status.textContent = '無法開啟資料夾：' + String(error);
    }
  });

  calculateDensity();
  loadMaterials();
})();