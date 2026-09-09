const ExcelExporter = {
  exportToExcel(projects) {
    if (!window.XLSX) {
      alert("XLSX 库未加载，请确保引入了 xlsx-js-style。");
      return;
    }

    const { startWeek, endWeek } = window.Scheduler.getTimelineRange(projects);
    const weeks = window.CertData.getWeekRange(startWeek, endWeek);
    const schedules = projects.map(p => window.Scheduler.generateSchedule(p));

    const wsData = [];
    const merges = [];

    // Row 1: Years & Left Column Titles
    const yearRow = ["#", "Region", "Cert Type", "Period", "DVT Qty", "PVT Qty", "Cert Fee"];
    let currentYear = null;
    let yearStartCol = 7;
    weeks.forEach((week, i) => {
      const year = week.substring(0, 4);
      yearRow.push(year);
      if (year !== currentYear) {
        if (currentYear !== null) {
            merges.push({s: {r: 0, c: yearStartCol}, e: {r: 0, c: 7 + i - 1}});
        }
        currentYear = year;
        yearStartCol = 7 + i;
      }
    });
    if (currentYear !== null) merges.push({s: {r: 0, c: yearStartCol}, e: {r: 0, c: 7 + weeks.length - 1}});
    wsData.push(yearRow);

    // Row 2: Months
    const monthRow = ["", "", "", "", "", "", ""];
    let currentMonth = null;
    let monthStartCol = 7;
    weeks.forEach((week, i) => {
      const month = window.CertData.getWeekMonth(week);
      monthRow.push(month);
      if (month !== currentMonth) {
        if (currentMonth !== null) {
          merges.push({s: {r: 1, c: monthStartCol}, e: {r: 1, c: 7 + i - 1}});
        }
        currentMonth = month;
        monthStartCol = 7 + i;
      }
    });
    if (currentMonth !== null) merges.push({s: {r: 1, c: monthStartCol}, e: {r: 1, c: 7 + weeks.length - 1}});
    wsData.push(monthRow);

    // Row 3: Week numbers
    const weekRow = ["", "", "", "", "", "", ""];
    weeks.forEach(week => {
      weekRow.push(week.split('-W')[1]);
    });
    wsData.push(weekRow);

    // Vertically merge left 7 columns across header Rows 0, 1, 2
    for (let c = 0; c < 7; c++) {
      merges.push({ s: { r: 0, c }, e: { r: 2, c } });
    }

    // Rows: Projects
    projects.forEach((p, pIndex) => {
      const totalWeeks = window.Scheduler.calculateProjectTotalWeeks ? window.Scheduler.calculateProjectTotalWeeks(p) : 0;
      const periodDisplay = totalWeeks > 0 ? `${totalWeeks} weeks` : (p.period || '-');
      const row = [pIndex + 1, p.region, p.operator, periodDisplay, p.dvt, p.pvt, p.certFee || '-'];
      weeks.forEach(() => row.push(""));
      wsData.push(row);

      const r = wsData.length - 1;
      const schedule = schedules[pIndex];
      const dhlPhases = schedule.filter(p => p.type === 'dhl');
      const mainPhases = schedule.filter(p => p.type !== 'dhl');

      const occupiedWeeks = new Set();

      mainPhases.forEach(phase => {
        const startIndex = weeks.indexOf(phase.startWeek);
        const endIndex = weeks.indexOf(phase.endWeek);
        if (startIndex === -1 || endIndex === -1) return;
        
        for (let i = startIndex; i <= endIndex; i++) {
          occupiedWeeks.add(i);
        }

        let label = phase.label || phase.type;
        if (phase.type === 'official') {
          label = 'Official';
        } else if (phase.type === 'fixing') {
          label = 'Fixing';
        } else if (phase.type === 'ivPass') {
          if (phase.ivRounds && phase.ivRounds > 1) {
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

        // Check if DHL overlaps with this phase
        const hasDHLOverlap = dhlPhases.some(dhl => {
          const sDiff = window.CertData.weekDiff(dhl.startWeek, phase.endWeek);
          const eDiff = window.CertData.weekDiff(dhl.endWeek, phase.startWeek);
          return sDiff <= 0 && eDiff >= 0;
        });

        if (hasDHLOverlap) {
          label += ' (DHL)';
        }

        row[7 + startIndex] = {
            v: label,
            t: 's',
            s: {
                fill: { fgColor: { rgb: (window.CertData.PHASE_COLORS[phase.type]?.bg || '#cccccc').replace('#', '') } },
                font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
                alignment: { horizontal: 'left', vertical: 'center' }
            }
        };

        if (endIndex > startIndex) {
            merges.push({ s: {r: r, c: 7 + startIndex}, e: {r: r, c: 7 + endIndex} });
        }
      });

      // Render standalone DHL cells for weeks not covered by main phases
      dhlPhases.forEach(dhl => {
        const startIndex = weeks.indexOf(dhl.startWeek);
        const endIndex = weeks.indexOf(dhl.endWeek);
        if (startIndex === -1 || endIndex === -1) return;

        let unmergedStart = null;
        for (let i = startIndex; i <= endIndex; i++) {
          if (!occupiedWeeks.has(i)) {
            if (unmergedStart === null) unmergedStart = i;
          } else {
            if (unmergedStart !== null) {
              row[7 + unmergedStart] = {
                v: 'DHL',
                t: 's',
                s: {
                  fill: { fgColor: { rgb: '64748B' } },
                  font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
                  alignment: { horizontal: 'left', vertical: 'center' }
                }
              };
              if (i - 1 > unmergedStart) {
                merges.push({ s: { r: r, c: 7 + unmergedStart }, e: { r: r, c: 7 + (i - 1) } });
              }
              unmergedStart = null;
            }
          }
        }
        if (unmergedStart !== null) {
          row[7 + unmergedStart] = {
            v: 'DHL',
            t: 's',
            s: {
              fill: { fgColor: { rgb: '64748B' } },
              font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
              alignment: { horizontal: 'left', vertical: 'center' }
            }
          };
          if (endIndex > unmergedStart) {
            merges.push({ s: { r: r, c: 7 + unmergedStart }, e: { r: r, c: 7 + endIndex } });
          }
        }
      });
    });

    // Add Legend Section to Excel Output
    wsData.push([]); // Empty row separator
    const legendTitleRowIndex = wsData.length;
    wsData.push([
      {
        v: "图例与阶段说明 (Legend & Phase Description)",
        t: 's',
        s: {
          font: { bold: true, sz: 11, color: { rgb: '0F172A' } },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          alignment: { horizontal: 'left', vertical: 'center' }
        }
      },
      "", "", "", "", "", ""
    ]);
    merges.push({ s: { r: legendTitleRowIndex, c: 0 }, e: { r: legendTitleRowIndex, c: 6 } });

    const LEGEND_ITEMS = [
      { type: 'ready',    label: 'Ready',    desc: 'Hardware & Software Ready (软硬件就绪)' },
      { type: 'iv',       label: 'IV',       desc: 'Internal Verification (预测试)' },
      { type: 'ivPass',   label: 'IV Pass',  desc: 'Verification Pass (预测试通过)' },
      { type: 'fixing',   label: 'Fixing',   desc: 'Bug Fixing (缺陷修复)' },
      { type: 'dhl',      label: 'DHL',      desc: 'DHL Shipping (样机寄送)' },
      { type: 'official', label: 'Official', desc: 'Official Testing (官方测试)' },
      { type: 'pass',     label: 'Pass',     desc: 'Certification Pass (正式通过)' }
    ];

    const legendStartRowIndex = wsData.length;
    LEGEND_ITEMS.forEach((item, itemIdx) => {
      const colorHex = (window.CertData.PHASE_COLORS[item.type]?.bg || '#cccccc').replace('#', '');
      const itemRow = [
        "", // Col 0 (#)
        {
          v: item.label,
          t: 's',
          s: {
            fill: { fgColor: { rgb: colorHex } },
            font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center' }
          }
        },
        {
          v: item.desc,
          t: 's',
          s: {
            font: { color: { rgb: '334155' }, bold: true, sz: 10 },
            alignment: { horizontal: 'left', vertical: 'center' }
          }
        },
        "", "", "", ""
      ];
      wsData.push(itemRow);
      const currentRowIndex = legendStartRowIndex + itemIdx;
      merges.push({ s: { r: currentRowIndex, c: 2 }, e: { r: currentRowIndex, c: 6 } });
    });

    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;
    ws['!cols'] = [
      {wch: 5},
      {wch: 12},
      {wch: 45},
      {wch: 12},
      {wch: 8},
      {wch: 8},
      {wch: 12},
      ...weeks.map(() => ({wch: 10}))
    ];

    const thinBorder = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    };

    // Apply header styles to Rows 0, 1, 2
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7 + weeks.length; c++) {
        const cellAddr = window.XLSX.utils.encode_cell({r, c});
        if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
        ws[cellAddr].s = {
          font: { bold: true, sz: 10, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          fill: { fgColor: { rgb: 'E2E8F0' } },
          border: thinBorder
        };
      }
    }

    // Apply borders to all project data rows
    for (let pIdx = 0; pIdx < projects.length; pIdx++) {
      const r = 3 + pIdx;
      for (let c = 0; c < 7 + weeks.length; c++) {
        const cellAddr = window.XLSX.utils.encode_cell({r, c});
        if (!ws[cellAddr]) ws[cellAddr] = { v: '', t: 's' };
        if (!ws[cellAddr].s) {
          ws[cellAddr].s = {
            font: { sz: 9.5, color: { rgb: '334155' } },
            alignment: { horizontal: c === 2 ? 'left' : 'center', vertical: 'center' },
            border: thinBorder
          };
        } else {
          ws[cellAddr].s.border = thinBorder;
        }
      }
    }

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Certification Plan");

    const dateStr = new Date().toISOString().split('T')[0];
    window.XLSX.writeFile(wb, `Certification-Plan-${dateStr}.xlsx`);
  }
};
window.ExcelExporter = ExcelExporter;
