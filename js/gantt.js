const GanttRenderer = {
  renderLegend() {
    const legendEl = document.getElementById('legend');
    if (!legendEl) return;
    legendEl.innerHTML = '';
    
    const PHASE_DESCRIPTIONS = {
      ready: 'Ready - Hardware & Software Ready (软硬件就绪与准备)',
      iv: 'IV - Internal Verification (内部预测试)',
      ivPass: 'IV Pass - Internal Verification Pass (内部预测试通过)',
      fixing: 'Fixing - Bug Fixing & Patching (Bug修复与回归)',
      dhl: 'DHL - Sample DHL Shipping (认证样机寄送)',
      official: 'Official - Official Certification Testing (官方机构认证测试)',
      pass: 'Pass - Official Certification Pass (官方认证正式通过)'
    };

    const LEGEND_DISPLAY = {
      ready: 'Ready (Hardware & Software Ready 软硬件就绪)',
      iv: 'IV (Internal Verification 预测试)',
      ivPass: 'IV Pass (Verification Pass 预测试通过)',
      fixing: 'Fixing (Bug Fixing 缺陷修复)',
      dhl: 'DHL (DHL Shipping 样机寄送)',
      official: 'Official (Official Testing 官方测试)',
      pass: 'Pass (Certification Pass 正式通过)'
    };

    const colors = window.CertData?.PHASE_COLORS || {};
    Object.entries(colors).forEach(([type, colorInfo]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.title = PHASE_DESCRIPTIONS[type] || colorInfo.label;
      
      const box = document.createElement('div');
      box.className = 'legend-color';
      box.style.backgroundColor = colorInfo.bg;
      if (type === 'dhl') {
        box.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)';
      }
      
      const label = document.createElement('span');
      label.textContent = LEGEND_DISPLAY[type] || colorInfo.label || type;
      
      item.appendChild(box);
      item.appendChild(label);
      legendEl.appendChild(item);
    });
  },

  renderGantt(projects) {
    const headerEl = document.getElementById('gantt-header');
    const projectRowsEl = document.getElementById('project-rows');
    const ganttBodyEl = document.getElementById('gantt-body');
    
    if (!projects || projects.length === 0) {
      projects = window.Storage.loadProjects();
    }

    projects = projects.map(p => window.CertData.createProject(p));

    let range = window.Scheduler.getTimelineRange(projects);
    if (!range.startWeek || !range.endWeek) {
      range = { startWeek: '2026-W35', endWeek: '2026-W52' };
    }

    const schedules = projects.map(p => window.Scheduler.generateSchedule(p));
    const weeks = window.CertData.getWeekRange(range.startWeek, range.endWeek);

    this.renderHeader(weeks);
    this.renderProjectInfo(projects);
    this.renderGanttRows(projects, weeks, schedules);
    this.setupSyncScroll();
    this.renderTodayLine(weeks);
  },

  renderHeader(weeks) {
    const headerEl = document.getElementById('gantt-header');
    if (!headerEl) return;
    headerEl.innerHTML = '';

    const yearRow = document.createElement('div');
    yearRow.className = 'year-row';
    const monthRow = document.createElement('div');
    monthRow.className = 'month-row';
    const weekRow = document.createElement('div');
    weekRow.className = 'week-row';

    let currentYear = null;
    let yearColspan = 0;
    
    let currentMonth = null;
    let monthColspan = 0;

    const createYearCell = (year, span) => {
      const cell = document.createElement('div');
      cell.className = 'header-cell year-cell';
      cell.style.flex = `0 0 calc(var(--cell-width, 40px) * ${span})`;
      cell.textContent = year;
      yearRow.appendChild(cell);
    };

    const createMonthCell = (monthStr, span) => {
      const cell = document.createElement('div');
      cell.className = 'header-cell month-cell';
      cell.style.flex = `0 0 calc(var(--cell-width, 40px) * ${span})`;
      cell.textContent = monthStr;
      monthRow.appendChild(cell);
    };

    weeks.forEach((week) => {
      const year = week.substring(0, 4);
      if (year !== currentYear) {
        if (currentYear !== null) createYearCell(currentYear, yearColspan);
        currentYear = year;
        yearColspan = 1;
      } else {
        yearColspan++;
      }

      const month = window.CertData.getWeekMonth(week);
      if (month !== currentMonth) {
        if (currentMonth !== null) createMonthCell(currentMonth, monthColspan);
        currentMonth = month;
        monthColspan = 1;
      } else {
        monthColspan++;
      }

      const { start, end } = window.CertData.getWeekDateRange(week);
      const startStr = `${start.getUTCMonth() + 1}/${start.getUTCDate()}`;
      const endStr = `${end.getUTCMonth() + 1}/${end.getUTCDate()}`;

      const weekCell = document.createElement('div');
      weekCell.className = 'header-cell week-cell';
      weekCell.textContent = week.split('-W')[1];
      weekCell.title = `周次: ${week}\n起始日期: ${startStr}\n日期范围: ${startStr} ~ ${endStr}`;
      weekRow.appendChild(weekCell);
    });

    if (currentYear !== null) createYearCell(currentYear, yearColspan);
    if (currentMonth !== null) createMonthCell(currentMonth, monthColspan);

    headerEl.appendChild(yearRow);
    headerEl.appendChild(monthRow);
    headerEl.appendChild(weekRow);
  },

  renderProjectInfo(projects) {
    const container = document.getElementById('project-rows');
    if (!container) return;
    container.innerHTML = '';

    projects.forEach((p, index) => {
      const totalWeeks = window.Scheduler.calculateProjectTotalWeeks ? window.Scheduler.calculateProjectTotalWeeks(p) : 0;
      const periodDisplay = totalWeeks > 0 ? `${totalWeeks} Wks` : (p.period ? p.period.replace('周', ' Wks') : '-');

      const row = document.createElement('div');
      const isSelected = window.App && window.App.selectedId === p.id;
      row.className = 'data-row' + (isSelected ? ' selected' : '');
      row.dataset.id = p.id;
      row.innerHTML = `
        <div class="col col-no" title="序号 ${index + 1}">${index + 1}</div>
        <div class="col col-region" title="${p.region}">${p.region}</div>
        <div class="col col-operator" title="${p.operator}">${p.operator}</div>
        <div class="col col-period" title="Total Duration: ${periodDisplay}">${periodDisplay}</div>
        <div class="col col-dvt" title="DVT 样机数量: ${p.dvt} 台">${p.dvt}</div>
        <div class="col col-pvt" title="PVT 样机数量: ${p.pvt} 台">${p.pvt}</div>
        <div class="col col-fee" title="认证费用: ${p.certFee || '-'}">${p.certFee || '-'}</div>
      `;
      row.addEventListener('click', (e) => {
        if (window.App && window.App.selectProject) window.App.selectProject(p.id);
      });
      row.addEventListener('dblclick', (e) => {
        document.dispatchEvent(new CustomEvent('edit-project', { detail: p.id }));
      });
      container.appendChild(row);
    });
  },

  renderGanttRows(projects, weeks, schedules) {
    const container = document.getElementById('gantt-body');
    if (!container) return;
    container.innerHTML = '';

    projects.forEach((p, index) => {
      const schedule = schedules[index];
      const row = document.createElement('div');
      const isSelected = window.App && window.App.selectedId === p.id;
      row.className = 'gantt-row' + (isSelected ? ' selected' : '');
      row.dataset.id = p.id;
      row.addEventListener('click', (e) => {
        if (e.target.classList.contains('phase-block')) return; // Ignore click inside phase block for selection
        if (window.App && window.App.selectProject) window.App.selectProject(p.id);
      });
      row.addEventListener('dblclick', (e) => {
        document.dispatchEvent(new CustomEvent('edit-project', { detail: p.id }));
      });

      schedule.forEach(phase => {
        const startIndex = weeks.indexOf(phase.startWeek);
        const endIndex = weeks.indexOf(phase.endWeek);
        if (startIndex === -1 || endIndex === -1) return;

        const block = document.createElement('div');
        block.className = 'phase-block';
        const left = startIndex;
        const width = Math.max(1, endIndex - startIndex + 1);
        
        block.style.left = `calc(var(--cell-width, 40px) * ${left})`;
        block.style.width = `calc(var(--cell-width, 40px) * ${width})`;
        
        const colorInfo = window.CertData?.PHASE_COLORS[phase.type] || { bg: '#ccc', text: '#fff' };
        block.style.backgroundColor = colorInfo.bg;
        block.style.color = colorInfo.text;
        
        if (phase.type === 'dhl') {
          const ivRounds = p.ivRounds !== undefined ? parseInt(p.ivRounds) : 1;
          if (ivRounds > 0 && block.classList) {
            block.classList.add('dhl');
          }
          block.style.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)';
        }

        let label = phase.label || phase.type;
        const blockWidthPx = width * 40;

        if (phase.type === 'official') {
          label = blockWidthPx < 50 ? 'Off' : 'Official';
        } else if (phase.type === 'fixing') {
          label = blockWidthPx < 60 ? 'Fix' : 'Fixing';
        } else if (phase.type === 'ivPass') {
          if (phase.ivRounds && phase.ivRounds > 1) {
            // Multi-round: IV₂P
            const sub = phase.ivRounds.toString().split('').map(c => String.fromCharCode(0x2080 + parseInt(c))).join('');
            label = 'IV' + sub + 'P';
          } else {
            label = 'IV P';
          }
        }

        if (phase.round != null && phase.type !== 'ivPass') {
          const sub = phase.round.toString().split('').map(c => String.fromCharCode(0x2080 + parseInt(c))).join('');
          label += sub;
        }
        block.textContent = label;

        const duration = phase.durationWeeks || width;
        const startRange = window.CertData.getWeekDateRange(phase.startWeek);
        const endRange = window.CertData.getWeekDateRange(phase.endWeek);
        const fmtDate = (d) => d.toISOString().slice(0, 10);
        block.title = `阶段: ${phase.label || phase.type}${phase.round != null ? ' (第'+phase.round+'轮)' : ''}\n周数: ${duration} 周\n时间: ${phase.startWeek} ~ ${phase.endWeek}\n日期: ${fmtDate(startRange.start)} ~ ${fmtDate(endRange.end)}`;

        row.appendChild(block);
      });
      
      container.appendChild(row);
    });
  },

  setupSyncScroll() {
    const scrollBody = document.getElementById('gantt-scroll-body');
    const headerContainer = document.getElementById('gantt-header-container');

    if (!this._scrollBound && scrollBody && headerContainer) {
      scrollBody.addEventListener('scroll', () => {
        headerContainer.scrollLeft = scrollBody.scrollLeft;
      });
      this._scrollBound = true;
    }
  },

  renderTodayLine(weeks) {
    const container = document.getElementById('gantt-body');
    if (!container) return;
    
    const oldLine = container.querySelector('.today-line');
    if (oldLine) oldLine.remove();

    const today = new Date();
    const currentYear = today.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const days = Math.floor((today - startOfYear) / (24 * 60 * 60 * 1000));
    const currentWeekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const todayWeek = `${currentYear}-W${currentWeekNum.toString().padStart(2, '0')}`;
    
    const index = weeks.indexOf(todayWeek);
    if (index !== -1) {
      const line = document.createElement('div');
      line.className = 'today-line';
      line.style.left = `calc(var(--cell-width, 40px) * ${index + 0.5})`;
      container.appendChild(line);
    }
  }
};
window.GanttRenderer = GanttRenderer;
