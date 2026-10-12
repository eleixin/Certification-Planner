const PHASE_COLORS = {
  ready:    { bg: '#7c3aed', text: '#fff', label: 'Ready' },
  iv:       { bg: '#f97316', text: '#fff', label: 'IV' },
  ivPass:   { bg: '#22c55e', text: '#fff', label: 'IV Pass' },
  fixing:   { bg: '#06b6d4', text: '#fff', label: 'Fixing' },
  dhl:      { bg: '#64748b', text: '#fff', label: 'DHL' },
  official: { bg: '#3b82f6', text: '#fff', label: 'Official' },
  pass:     { bg: '#22c55e', text: '#fff', label: 'Pass' }
};

function createProject(overrides = {}) {
  const nowIso = getISOWeek(new Date());
  const defaultWeek = toWeekString(nowIso.year, nowIso.week);
  const readyW = overrides.readyWeek || overrides.swReadyWeek || overrides.hwReadyWeek || overrides.startWeek || defaultWeek;
  return {
    ...overrides,
    id: overrides.id || ('proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
    region: overrides.region || 'Common',
    operator: overrides.operator || overrides.name || overrides.title || overrides.certType || '',
    period: overrides.period || '',
    dvt: overrides.dvt ?? 0,
    pvt: overrides.pvt ?? 0,
    certFee: overrides.certFee !== undefined ? overrides.certFee : (overrides.fee || ''),
    readyWeek: readyW,
    hwReadyWeek: readyW,
    swReadyWeek: readyW,
    ivRounds: overrides.ivRounds !== undefined ? parseInt(overrides.ivRounds) : 1,
    ivWeeks: (Array.isArray(overrides.ivWeeks) && overrides.ivWeeks.length > 0) ? overrides.ivWeeks.map(x => parseInt(x) || 2) : [2],
    ivFixWeeks: Array.isArray(overrides.ivFixWeeks) ? overrides.ivFixWeeks.map(x => parseInt(x) || 2) : [],
    officialRounds: overrides.officialRounds !== undefined ? parseInt(overrides.officialRounds) : 1,
    offWeeks: (Array.isArray(overrides.offWeeks) && overrides.offWeeks.length > 0) ? overrides.offWeeks.map(x => parseInt(x) || 4) : [4],
    offFixWeeks: Array.isArray(overrides.offFixWeeks) ? overrides.offFixWeeks.map(x => parseInt(x) || 2) : [],
    enableDHL: !!overrides.enableDHL,
    dhlWeeks: parseInt(overrides.dhlWeeks) || 2
  };
}

function parseWeekString(weekStr) {
  if (!weekStr) return { year: 0, week: 0 };
  const [yearStr, weekStrPart] = weekStr.split('-W');
  return { year: parseInt(yearStr, 10), week: parseInt(weekStrPart, 10) };
}

function toWeekString(year, week) {
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekDate(year, week, dayOfWeek = 1) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  let jan4Day = jan4.getUTCDay();
  if (jan4Day === 0) jan4Day = 7;
  
  const week1Start = new Date(jan4);
  week1Start.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  
  const reqDate = new Date(week1Start);
  reqDate.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7 + (dayOfWeek - 1));
  return reqDate;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  };
}

function weekDiff(weekStr1, weekStr2) {
  if (!weekStr1 || !weekStr2) return 0;
  const w1 = parseWeekString(weekStr1);
  const w2 = parseWeekString(weekStr2);
  const d1 = getWeekDate(w1.year, w1.week);
  const d2 = getWeekDate(w2.year, w2.week);
  return Math.round((d1.getTime() - d2.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function offsetWeek(weekStr, offset) {
  if (!weekStr) return '';
  const w = parseWeekString(weekStr);
  const d = getWeekDate(w.year, w.week);
  d.setUTCDate(d.getUTCDate() + offset * 7);
  const res = getISOWeek(d);
  return toWeekString(res.year, res.week);
}

function getWeekDateRange(weekStr) {
  const w = parseWeekString(weekStr);
  const start = getWeekDate(w.year, w.week, 1);
  const end = getWeekDate(w.year, w.week, 7);
  return { start, end };
}

function getWeekMonth(weekStr) {
  const w = parseWeekString(weekStr);
  const thurs = getWeekDate(w.year, w.week, 4);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[thurs.getUTCMonth()];
}

function getWeeksInMonth(year, month) {
  const weeks = new Set();
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
      const res = getISOWeek(d);
      weeks.add(toWeekString(res.year, res.week));
      d.setUTCDate(d.getUTCDate() + 1);
  }
  return Array.from(weeks);
}

function getWeekRange(startWeekStr, endWeekStr) {
  if (!startWeekStr || !endWeekStr) return [];
  const range = [];
  let curr = startWeekStr;
  while (weekDiff(endWeekStr, curr) >= 0) {
    range.push(curr);
    curr = offsetWeek(curr, 1);
  }
  return range;
}

const REGION_ORDER = ['Common', 'UK', 'Germany', 'Netherlands', 'Italy', 'Poland', 'France', 'Spain'];

const COMMON_OPERATOR_ORDER = [
  'HDMI',
  'Dolby Atmos',
  'FMM',
  'HDR10+',
  'Freesync Premium',
  'Freesync Premium Pro',
  'Dolby Vision',
  'BQB',
  'CI 1.4&2.0 ECP',
  'Hbbtv'
];

const RAW_DEFAULT_PROJECTS = [
  {
    "region": "Common",
    "operator": "HDMI(65X95D)",
    "period": "9 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "150000RMB",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 0,
    "ivWeeks": [2],
    "ivFixWeeks": [],
    "officialRounds": 3,
    "offWeeks": [1, 1, 1],
    "offFixWeeks": [2, 2],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "mso5veinhmrl4"
  },
  {
    "region": "Common",
    "operator": "Dolby Atmos(55X95D EU)",
    "period": "8 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 1],
    "ivFixWeeks": [2, 2],
    "officialRounds": 0,
    "offWeeks": [4],
    "offFixWeeks": [],
    "enableDHL": false,
    "dhlWeeks": 2,
    "id": "mso5vein42p0o"
  },
  {
    "region": "Common",
    "operator": "Dolby Atmos(55X95D NA)",
    "period": "8 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 1],
    "ivFixWeeks": [2, 2],
    "officialRounds": 0,
    "offWeeks": [4],
    "offFixWeeks": [],
    "enableDHL": false,
    "dhlWeeks": 2,
    "id": "proj_mv4vrj3ib775"
  },
  {
    "region": "Common",
    "operator": "FMM(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 1,
    "ivWeeks": [4],
    "ivFixWeeks": [],
    "officialRounds": 0,
    "offWeeks": [4],
    "offFixWeeks": [],
    "enableDHL": false,
    "dhlWeeks": 2,
    "id": "mso5vein2zp8q"
  },
  {
    "region": "Common",
    "operator": "HDR10+(55X95D)",
    "period": "7 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "20000RMB",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 1],
    "ivFixWeeks": [1, 1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": false,
    "dhlWeeks": 2,
    "id": "mso5veinbt1vv"
  },
  {
    "region": "Common",
    "operator": "HDR10+(42Z90D)",
    "period": "7 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "20000RMB",
    "readyWeek": "2026-W46",
    "hwReadyWeek": "2026-W46",
    "swReadyWeek": "2026-W46",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 1],
    "ivFixWeeks": [1, 1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": false,
    "dhlWeeks": 2,
    "id": "proj_mv4vvvph0xfn"
  },
  {
    "region": "Common",
    "operator": "Freesync Premium(55X95D)",
    "period": "10 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 2],
    "ivFixWeeks": [2, 2],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 2,
    "id": "mso5veinqem3b"
  },
  {
    "region": "Common",
    "operator": "Freesync Premium(42Z90D)",
    "period": "10 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W46",
    "hwReadyWeek": "2026-W46",
    "swReadyWeek": "2026-W46",
    "ivRounds": 3,
    "ivWeeks": [1, 1, 2],
    "ivFixWeeks": [2, 2],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 2,
    "id": "mso5vein6ceht"
  },
  {
    "region": "Common",
    "operator": "Dolby Vision 2 MAX(85X99D)",
    "period": "12 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W46",
    "hwReadyWeek": "2026-W46",
    "swReadyWeek": "2026-W46",
    "ivRounds": 3,
    "ivWeeks": [2, 1, 1],
    "ivFixWeeks": [2, 1],
    "officialRounds": 2,
    "offWeeks": [2, 1],
    "offFixWeeks": [1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_muc394xdw05b"
  },
  {
    "region": "Common",
    "operator": "Dolby Vision 2 MAX(42Z90D)",
    "period": "12 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W46",
    "hwReadyWeek": "2026-W46",
    "swReadyWeek": "2026-W46",
    "ivRounds": 3,
    "ivWeeks": [2, 1, 1],
    "ivFixWeeks": [2, 1],
    "officialRounds": 2,
    "offWeeks": [2, 1],
    "offFixWeeks": [1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv4vgwqf2imi"
  },
  {
    "region": "Common",
    "operator": "BQB(55X95D)",
    "period": "8 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "100000RMB",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 0,
    "ivWeeks": [2],
    "ivFixWeeks": [],
    "officialRounds": 3,
    "offWeeks": [1, 1, 1],
    "offFixWeeks": [2, 1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mso9mm3ps4sb"
  },
  {
    "region": "Common",
    "operator": "Dolby Vison 2(55X95D)",
    "period": "12 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "0",
    "readyWeek": "2026-W43",
    "hwReadyWeek": "2026-W43",
    "swReadyWeek": "2026-W43",
    "ivRounds": 3,
    "ivWeeks": [2, 1, 1],
    "ivFixWeeks": [2, 1],
    "officialRounds": 2,
    "offWeeks": [2, 1],
    "offFixWeeks": [1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_muc368l7ojz5"
  },
  {
    "region": "Common",
    "operator": "Dolby Vison 2(55Z86D)",
    "period": "12 Wks",
    "dvt": 2,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W45",
    "hwReadyWeek": "2026-W45",
    "swReadyWeek": "2026-W45",
    "ivRounds": 3,
    "ivWeeks": [2, 1, 1],
    "ivFixWeeks": [2, 1],
    "officialRounds": 2,
    "offWeeks": [2, 1],
    "offFixWeeks": [1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv4pptvy6ro2"
  },
  {
    "region": "Common",
    "operator": "Low blue light Cert(55X95D)",
    "period": "9 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [2, 1],
    "ivFixWeeks": [1],
    "officialRounds": 2,
    "offWeeks": [2, 1],
    "offFixWeeks": [1],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv530970id0w"
  },
  {
    "region": "Common",
    "operator": "EMC&RF(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [1, 1],
    "ivFixWeeks": [1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv534k1ez8vn"
  },
  {
    "region": "Common",
    "operator": "ERP certification(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [1, 1],
    "ivFixWeeks": [1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv5371qkbw1k"
  },
  {
    "region": "Common",
    "operator": "ISTA-6A certification(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [1, 1],
    "ivFixWeeks": [1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv5370fbz4az"
  },
  {
    "region": "Common",
    "operator": "RED-Safety certification(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [1, 1],
    "ivFixWeeks": [1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv5371936ak5"
  },
  {
    "region": "Common",
    "operator": "ISTA 6-SAMSCLUB certification(55X95D)",
    "period": "5 Wks",
    "dvt": 1,
    "pvt": 0,
    "certFee": "",
    "readyWeek": "2026-W48",
    "hwReadyWeek": "2026-W48",
    "swReadyWeek": "2026-W48",
    "ivRounds": 2,
    "ivWeeks": [1, 1],
    "ivFixWeeks": [1],
    "officialRounds": 1,
    "offWeeks": [1],
    "offFixWeeks": [],
    "enableDHL": true,
    "dhlWeeks": 1,
    "id": "proj_mv537exg1mrd"
  }
];

const DEFAULT_PROJECTS = RAW_DEFAULT_PROJECTS.map(p => ({ ...p }));

function sortProjectsByRegion(projects) {
  if (!Array.isArray(projects)) return [];
  return [...projects];
}

window.CertData = {
  PHASE_COLORS, 
  createProject, 
  parseWeekString, 
  toWeekString, 
  getISOWeek,
  weekDiff, 
  offsetWeek, 
  getWeekDateRange, 
  getWeekMonth,
  getWeeksInMonth, 
  getWeekRange, 
  DEFAULT_PROJECTS, 
  REGION_ORDER,
  sortProjectsByRegion
};
