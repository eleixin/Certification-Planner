function addPhase(phases, type, round, startWeek, durationWeeks, label) {
  const duration = Math.max(1, parseInt(durationWeeks) || 1);
  const endWeek = window.CertData.offsetWeek(startWeek, duration - 1);
  const nextStart = window.CertData.offsetWeek(startWeek, duration);
  phases.push({
    type,
    round,
    startWeek,
    endWeek,
    durationWeeks: duration,
    label
  });
  return nextStart;
}

function generateSchedule(project) {
  const readyWeek = project.readyWeek || project.swReadyWeek || project.hwReadyWeek;
  if (!readyWeek) return [];
  
  const { offsetWeek } = window.CertData;
  let cursor = offsetWeek(readyWeek, 1);
  
  const phases = [];
  
  // Single Ready phase
  phases.push({
    type: 'ready',
    startWeek: readyWeek,
    endWeek: readyWeek,
    durationWeeks: 1,
    label: 'Ready'
  });
  
  // IV Rounds
  const ivRounds = project.ivRounds !== undefined ? parseInt(project.ivRounds) : 1;
  const ivWeeks = Array.isArray(project.ivWeeks) ? project.ivWeeks : [2];
  const ivFixWeeks = Array.isArray(project.ivFixWeeks) ? project.ivFixWeeks : [];

  if (ivRounds > 0) {
    let lastIvStart = null;
    for (let r = 0; r < ivRounds; r++) {
      const duration = parseInt(ivWeeks[r]) || 2;
      const roundNum = ivRounds > 1 ? r + 1 : null;
      const ivStart = cursor;
      const isLastRound = (r === ivRounds - 1);
      
      if (isLastRound) lastIvStart = ivStart;
      
      if (!isLastRound) {
        // Non-last round: normal IV + Fixing
        cursor = addPhase(phases, 'iv', roundNum, cursor, duration, 'IV');
        const fixDuration = parseInt(ivFixWeeks[r]) || 2;
        cursor = addPhase(phases, 'fixing', roundNum, cursor, fixDuration, 'Fixing');
      } else {
        // Last round (single-round or multi-round): directly output ivPass block (green) with full IV duration
        const ivPassStart = cursor;
        cursor = addPhase(phases, 'ivPass', roundNum, cursor, duration, 'IV Pass');
        phases[phases.length - 1].ivRounds = ivRounds;
        
        // DHL: starts at last IV round start
        if (project.enableDHL) {
          const dhlWeeks = parseInt(project.dhlWeeks) || 2;
          const dhlStart = lastIvStart || ivPassStart;
          const dhlEnd = offsetWeek(dhlStart, dhlWeeks - 1);
          phases.push({ type: 'dhl', startWeek: dhlStart, endWeek: dhlEnd, durationWeeks: dhlWeeks, label: 'DHL' });
          const dhlNext = offsetWeek(dhlEnd, 1);
          if (window.CertData.weekDiff(dhlNext, cursor) > 0) {
            cursor = dhlNext;
          }
        }
      }
    }
  } else if (project.enableDHL) {
    // No IV rounds: DHL starts right after Ready, directly before Official
    const dhlWeeks = parseInt(project.dhlWeeks) || 2;
    const dhlStart = cursor;
    const dhlEnd = offsetWeek(dhlStart, dhlWeeks - 1);
    phases.push({ type: 'dhl', startWeek: dhlStart, endWeek: dhlEnd, durationWeeks: dhlWeeks, label: 'DHL' });
    cursor = offsetWeek(dhlEnd, 1);
  }
  
  // Official Rounds
  const officialRounds = project.officialRounds !== undefined ? parseInt(project.officialRounds) : 1;
  const offWeeks = Array.isArray(project.offWeeks) ? project.offWeeks : [4];
  const offFixWeeks = Array.isArray(project.offFixWeeks) ? project.offFixWeeks : [];

  if (officialRounds > 0) {
    for (let r = 0; r < officialRounds; r++) {
      const roundNum = officialRounds > 1 ? r + 1 : null;
      if (r > 0) {
        const fixDuration = parseInt(offFixWeeks[r - 1]) || 2;
        cursor = addPhase(phases, 'fixing', roundNum ? r : null, cursor, fixDuration, 'Fixing');
      }
      const offDuration = parseInt(offWeeks[r]) || 4;
      cursor = addPhase(phases, 'official', roundNum, cursor, offDuration, 'Official');
    }
  }
  
  // Final Pass milestone (starts in the week AFTER Official ends)
  const finalPassWeek = cursor;
  phases.push({ type: 'pass', startWeek: finalPassWeek, endWeek: finalPassWeek, durationWeeks: 1, label: 'Pass' });
  
  return phases;
}

function getTimelineRange(projects) {
  if (!projects || projects.length === 0) return { startWeek: null, endWeek: null };
  
  const { offsetWeek, weekDiff } = window.CertData;
  let minWeek = null;
  let maxWeek = null;
  
  projects.forEach(p => {
    const readyWeek = p.readyWeek || p.swReadyWeek || p.hwReadyWeek;
    if (!readyWeek) return;
    const phases = generateSchedule(p);
    if (phases.length === 0) return;
    
    phases.forEach(phase => {
      if (!minWeek || weekDiff(phase.startWeek, minWeek) < 0) {
        minWeek = phase.startWeek;
      }
      if (!maxWeek || weekDiff(phase.endWeek, maxWeek) > 0) {
        maxWeek = phase.endWeek;
      }
    });
  });
  
  if (!minWeek || !maxWeek) return { startWeek: null, endWeek: null };
  
  return {
    startWeek: offsetWeek(minWeek, -2),
    endWeek: offsetWeek(maxWeek, 2)
  };
}

function calculateProjectTotalWeeks(project) {
  const readyWeek = project.readyWeek || project.swReadyWeek || project.hwReadyWeek;
  if (!readyWeek) return 0;
  const phases = generateSchedule(project);
  if (!phases || phases.length < 2) return 0;
  
  // Ready 不计入总 Period，从 Ready 之后的第一个测试阶段 (phases[1]) 开始计算到 Pass 结束
  const startWeek = phases[1].startWeek;
  const passPhase = phases.find(p => p.type === 'pass') || phases[phases.length - 1];
  const endWeek = passPhase.endWeek;
  
  return window.CertData.weekDiff(endWeek, startWeek) + 1;
}

window.Scheduler = { generateSchedule, getTimelineRange, calculateProjectTotalWeeks };
