const App = {
  projects: [],
  editingId: null,
  selectedId: null,

  init() {
    this.projects = window.Storage.loadProjects();
    window.GanttRenderer.renderLegend();
    window.GanttRenderer.renderGantt(this.projects);
    this.bindEvents();
  },

  selectProject(id) {
    this.selectedId = id;
    document.querySelectorAll('.data-row, .gantt-row').forEach(row => {
      if (row.dataset.id === id) {
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    });
  },

  bindEvents() {
    document.getElementById('btn-add')?.addEventListener('click', () => this.openModal(null));
    document.getElementById('btn-export-excel')?.addEventListener('click', () => window.ExcelExporter.exportToExcel(this.projects));
    document.getElementById('btn-export-json')?.addEventListener('click', () => window.Storage.exportJSON(this.projects));

    const fileImport = document.getElementById('file-import');
    document.getElementById('btn-import-json')?.addEventListener('click', () => fileImport?.click());
    fileImport?.addEventListener('change', async (e) => {
      if (!e.target.files.length) return;
      try {
        const imported = await window.Storage.importJSON(e.target.files[0]);
        if (imported && imported.length > 0) {
          this.projects = imported;
          window.Storage.saveProjects(this.projects);
          window.GanttRenderer.renderGantt(this.projects);
          alert(`🎉 成功导入 ${this.projects.length} 个认证项目！界面与排期图已即时更新。`);
        }
      } catch (err) {
        alert('导入失败: ' + err.message);
      }
      e.target.value = '';
    });

    document.getElementById('btn-modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-save')?.addEventListener('click', () => this.saveProject());
    document.getElementById('btn-delete')?.addEventListener('click', () => this.deleteProject());
    document.getElementById('btn-save-default')?.addEventListener('click', () => {
      window.Storage.saveAsDefault(this.projects);
      alert('已成功将当前所有项目与排期配置保存为默认基线！\n以后随时点击【🔄 重置】均会恢复至当前状态。');
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (confirm('确定要重置恢复为默认预设的认证项目数据吗？')) {
        this.projects = window.Storage.resetToDefault();
        window.GanttRenderer.renderGantt(this.projects);
      }
    });

    // Global Ready Week: batch-apply to all projects
    document.getElementById('btn-apply-global-ready')?.addEventListener('click', () => {
      const input = document.getElementById('input-global-ready');
      const week = input?.value?.trim();
      if (!week) {
        alert('请先选择一个 Ready 周次');
        return;
      }
      if (!confirm(`确定将所有项目的 Ready Week 统一更新为 ${week} 吗？`)) return;
      this.projects.forEach(p => { p.readyWeek = week; });
      window.Storage.saveProjects(this.projects);
      window.GanttRenderer.renderGantt(this.projects);
    });

    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });

    document.getElementById('input-iv-rounds')?.addEventListener('change', (e) => {
      this.updateIVRoundsUI(parseInt(e.target.value));
      this.updateLiveSummary();
    });
    document.getElementById('input-off-rounds')?.addEventListener('change', (e) => {
      this.updateOffRoundsUI(parseInt(e.target.value));
      this.updateLiveSummary();
    });
    document.getElementById('input-dhl-enable')?.addEventListener('change', (e) => {
      const group = document.getElementById('dhl-weeks-group');
      if (group) group.style.display = e.target.checked ? 'block' : 'none';
      this.updateLiveSummary();
    });

    // Listen to form input changes for live summary
    document.getElementById('project-form')?.addEventListener('input', () => {
      this.updateLiveSummary();
    });

    document.addEventListener('edit-project', (e) => this.openModal(e.detail));
  },

  openModal(projectId) {
    this.editingId = projectId;
    const modal = document.getElementById('modal-overlay');
    const deleteBtn = document.getElementById('btn-delete');
    const title = document.getElementById('modal-title');
    const insertPosRow = document.getElementById('insert-pos-row');
    const insertPosSelect = document.getElementById('input-insert-pos');

    if (projectId) {
      if (title) title.textContent = '编辑认证项目配置';
      if (deleteBtn) deleteBtn.style.display = 'block';
      if (insertPosRow) insertPosRow.style.display = 'none';
      const p = this.projects.find(x => x.id === projectId);
      if (p) this.fillForm(p);
    } else {
      if (title) title.textContent = '新增认证项目配置';
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (insertPosRow) insertPosRow.style.display = 'block';
      
      const selIdx = this.selectedId ? this.projects.findIndex(x => x.id === this.selectedId) : -1;
      if (insertPosSelect) {
        if (selIdx !== -1) {
          const selP = this.projects[selIdx];
          insertPosSelect.innerHTML = `
            <option value="after-selected">插入在选中的行下方 (第 ${selIdx + 1} 行: ${selP.operator})</option>
            <option value="end">插入在列表末尾</option>
          `;
          insertPosSelect.value = 'after-selected';
        } else {
          insertPosSelect.innerHTML = `<option value="end">插入在列表末尾</option>`;
          insertPosSelect.value = 'end';
        }
      }
      this.resetForm();
    }

    if (modal) modal.classList.add('active');
    this.updateLiveSummary();
  },

  resetForm() {
    const el = (id) => document.getElementById(id);
    if (el('input-region')) el('input-region').value = 'Common';
    if (el('input-operator')) el('input-operator').value = '';
    if (el('input-period')) el('input-period').value = '';
    if (el('input-dvt')) el('input-dvt').value = '0';
    if (el('input-pvt')) el('input-pvt').value = '0';
    
    // Default start weeks to current week or 2026-W35
    const today = new Date();
    const iso = window.CertData.getISOWeek ? window.CertData.getISOWeek(today) : { year: 2026, week: 35 };
    const defaultWeek = window.CertData.toWeekString(iso.year, iso.week);
    
    if (el('input-ready-week')) el('input-ready-week').value = defaultWeek;
    if (el('input-iv-rounds')) el('input-iv-rounds').value = '1';
    if (el('input-off-rounds')) el('input-off-rounds').value = '1';
    if (el('input-dhl-enable')) el('input-dhl-enable').checked = false;
    if (el('dhl-weeks-group')) el('dhl-weeks-group').style.display = 'none';
    if (el('input-dhl-weeks')) el('input-dhl-weeks').value = '2';
    
    this.updateIVRoundsUI(1, [2], []);
    this.updateOffRoundsUI(1, [4], []);
  },

  fillForm(p) {
    const el = (id) => document.getElementById(id);
    if (el('input-region')) el('input-region').value = p.region || 'Common';
    if (el('input-operator')) el('input-operator').value = p.operator || '';
    if (el('input-period')) el('input-period').value = p.period || '';
    if (el('input-dvt')) el('input-dvt').value = p.dvt ?? 0;
    if (el('input-pvt')) el('input-pvt').value = p.pvt ?? 0;
    
    const readyVal = p.readyWeek || p.swReadyWeek || p.hwReadyWeek || '';
    if (el('input-ready-week')) el('input-ready-week').value = readyVal;

    const ivRounds = p.ivRounds !== undefined ? p.ivRounds : 1;
    if (el('input-iv-rounds')) el('input-iv-rounds').value = ivRounds;
    this.updateIVRoundsUI(ivRounds, p.ivWeeks || [2], p.ivFixWeeks || []);

    const offRounds = p.officialRounds !== undefined ? p.officialRounds : 1;
    if (el('input-off-rounds')) el('input-off-rounds').value = offRounds;
    this.updateOffRoundsUI(offRounds, p.offWeeks || [4], p.offFixWeeks || []);

    if (el('input-dhl-enable')) el('input-dhl-enable').checked = !!p.enableDHL;
    if (el('dhl-weeks-group')) el('dhl-weeks-group').style.display = p.enableDHL ? 'block' : 'none';
    if (el('input-dhl-weeks')) el('input-dhl-weeks').value = p.dhlWeeks || 2;
  },

  updateIVRoundsUI(rounds, ivWeeks, ivFixWeeks) {
    const container = document.getElementById('iv-rounds-config');
    if (!container) return;

    if (rounds === 0) {
      container.innerHTML = '<div class="empty-rounds-msg" style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">已选择：不启用 IV 内部测试阶段</div>';
      return;
    }

    if (!Array.isArray(ivWeeks)) {
      ivWeeks = this._collectIVWeeks() || [2];
      ivFixWeeks = this._collectIVFixWeeks() || [];
    }

    container.innerHTML = '';

    for (let i = 0; i < rounds; i++) {
      const row = document.createElement('div');
      row.className = 'round-row';

      const ivVal = ivWeeks[i] !== undefined ? ivWeeks[i] : 2;
      const fixVal = ivFixWeeks[i] !== undefined ? ivFixWeeks[i] : 2;

      let html = `<span class="round-label">第 ${i + 1} 轮</span>
        <div class="form-group">
          <label>IV 测试周数</label>
          <div class="number-input-group">
            <button type="button" class="btn-step btn-minus" data-target="iv-${i}">-</button>
            <input type="number" id="iv-${i}" class="iv-week-input" min="1" max="20" value="${ivVal}" />
            <button type="button" class="btn-step btn-plus" data-target="iv-${i}">+</button>
          </div>
        </div>`;

      if (i < rounds - 1) {
        html += `<div class="form-group">
          <label>Fixing 修复周数</label>
          <div class="number-input-group">
            <button type="button" class="btn-step btn-minus" data-target="ivfix-${i}">-</button>
            <input type="number" id="ivfix-${i}" class="iv-fix-input" min="1" max="20" value="${fixVal}" />
            <button type="button" class="btn-step btn-plus" data-target="ivfix-${i}">+</button>
          </div>
        </div>`;
      }

      row.innerHTML = html;
      container.appendChild(row);
    }

    this.attachStepButtons(container);
  },

  updateOffRoundsUI(rounds, offWeeks, offFixWeeks) {
    const container = document.getElementById('off-rounds-config');
    if (!container) return;

    if (rounds === 0) {
      container.innerHTML = '<div class="empty-rounds-msg" style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem 0;">已选择：不启用 Official 官方测试阶段</div>';
      return;
    }

    if (!Array.isArray(offWeeks)) {
      offWeeks = this._collectOffWeeks() || [4];
      offFixWeeks = this._collectOffFixWeeks() || [];
    }

    container.innerHTML = '';

    for (let i = 0; i < rounds; i++) {
      const row = document.createElement('div');
      row.className = 'round-row';

      const offVal = offWeeks[i] !== undefined ? offWeeks[i] : 4;
      const fixVal = (i > 0 && offFixWeeks[i - 1] !== undefined) ? offFixWeeks[i - 1] : 2;

      let html = `<span class="round-label">第 ${i + 1} 轮</span>`;

      if (i > 0) {
        html += `<div class="form-group">
          <label>Fixing 修复周数</label>
          <div class="number-input-group">
            <button type="button" class="btn-step btn-minus" data-target="offfix-${i-1}">-</button>
            <input type="number" id="offfix-${i-1}" class="off-fix-input" min="1" max="20" value="${fixVal}" />
            <button type="button" class="btn-step btn-plus" data-target="offfix-${i-1}">+</button>
          </div>
        </div>`;
      }

      html += `<div class="form-group">
        <label>Official 官方周数</label>
        <div class="number-input-group">
          <button type="button" class="btn-step btn-minus" data-target="off-${i}">-</button>
          <input type="number" id="off-${i}" class="off-week-input" min="1" max="20" value="${offVal}" />
          <button type="button" class="btn-step btn-plus" data-target="off-${i}">+</button>
        </div>
      </div>`;

      row.innerHTML = html;
      container.appendChild(row);
    }

    this.attachStepButtons(container);
  },

  attachStepButtons(container) {
    container.querySelectorAll('.btn-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input && parseInt(input.value) > 1) {
          input.value = parseInt(input.value) - 1;
          this.updateLiveSummary();
        }
      });
    });
    container.querySelectorAll('.btn-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          input.value = parseInt(input.value) + 1;
          this.updateLiveSummary();
        }
      });
    });
  },

  _collectIVWeeks() {
    return Array.from(document.querySelectorAll('.iv-week-input')).map(el => parseInt(el.value) || 2);
  },
  _collectIVFixWeeks() {
    return Array.from(document.querySelectorAll('.iv-fix-input')).map(el => parseInt(el.value) || 2);
  },
  _collectOffWeeks() {
    return Array.from(document.querySelectorAll('.off-week-input')).map(el => parseInt(el.value) || 4);
  },
  _collectOffFixWeeks() {
    return Array.from(document.querySelectorAll('.off-fix-input')).map(el => parseInt(el.value) || 2);
  },

  getTempProjectFromForm() {
    const el = (id) => document.getElementById(id);
    const ivVal = el('input-iv-rounds')?.value;
    const offVal = el('input-off-rounds')?.value;
    const readyWeekVal = el('input-ready-week')?.value || '2026-W35';
    return {
      region: el('input-region')?.value || 'Common',
      operator: el('input-operator')?.value || 'Demo',
      period: el('input-period')?.value || '',
      dvt: parseInt(el('input-dvt')?.value) || 0,
      pvt: parseInt(el('input-pvt')?.value) || 0,
      readyWeek: readyWeekVal,
      hwReadyWeek: readyWeekVal,
      swReadyWeek: readyWeekVal,
      ivRounds: ivVal !== undefined && ivVal !== '' ? parseInt(ivVal) : 1,
      ivWeeks: this._collectIVWeeks(),
      ivFixWeeks: this._collectIVFixWeeks(),
      officialRounds: offVal !== undefined && offVal !== '' ? parseInt(offVal) : 1,
      offWeeks: this._collectOffWeeks(),
      offFixWeeks: this._collectOffFixWeeks(),
      enableDHL: el('input-dhl-enable')?.checked || false,
      dhlWeeks: parseInt(el('input-dhl-weeks')?.value) || 2
    };
  },

  updateLiveSummary() {
    const tempP = this.getTempProjectFromForm();
    if (!tempP.readyWeek) return;

    const phases = window.Scheduler.generateSchedule(tempP);
    if (phases.length < 2) return;

    const startWeek = phases[1].startWeek;
    const endWeek = phases[phases.length - 1].endWeek;
    const totalWeeks = window.CertData.weekDiff(endWeek, startWeek) + 1;

    const totalWeeksEl = document.getElementById('summary-total-weeks');
    const dateRangeEl = document.getElementById('summary-date-range');
    const periodInput = document.getElementById('input-period');

    if (totalWeeksEl) totalWeeksEl.textContent = `总排期 (不含Ready): ${totalWeeks} Wks`;
    if (dateRangeEl) dateRangeEl.textContent = `测试跨度: ${startWeek} ~ ${endWeek}`;
    if (periodInput) periodInput.value = `${totalWeeks} Wks`;
  },

  saveProject() {
    const el = (id) => document.getElementById(id);
    const operator = el('input-operator')?.value.trim() || '';
    const readyWeek = el('input-ready-week')?.value || '';

    if (!operator || !readyWeek) {
      alert('Cert Type (认证类型/运营商) 与 Ready Week (就绪周次) 为必填项');
      return;
    }

    const projectData = this.getTempProjectFromForm();

    if (this.editingId) {
      const idx = this.projects.findIndex(x => x.id === this.editingId);
      if (idx !== -1) {
        projectData.id = this.editingId;
        this.projects[idx] = projectData;
      }
    } else {
      const newProject = window.CertData.createProject(projectData);
      const insertPos = el('input-insert-pos')?.value || 'end';
      const selIdx = this.selectedId ? this.projects.findIndex(x => x.id === this.selectedId) : -1;

      if (insertPos === 'after-selected' && selIdx !== -1) {
        this.projects.splice(selIdx + 1, 0, newProject);
      } else {
        this.projects.push(newProject);
      }
      this.selectedId = newProject.id;
    }

    window.Storage.saveProjects(this.projects);
    window.GanttRenderer.renderGantt(this.projects);
    this.closeModal();
  },

  deleteProject() {
    if (!this.editingId) return;
    if (confirm('确定要删除此项目吗？')) {
      this.projects = this.projects.filter(p => p.id !== this.editingId);
      window.Storage.saveProjects(this.projects);
      window.GanttRenderer.renderGantt(this.projects);
      this.closeModal();
    }
  },

  closeModal() {
    this.editingId = null;
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
  }
};

window.App = App;
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => App.init(), 0);
} else {
  document.addEventListener('DOMContentLoaded', () => App.init());
}
