const KEY = 'cert-planner-projects';
const DEFAULT_KEY = 'cert-planner-custom-default';

const Storage = {
  loadProjects() {
    try {
      const data = localStorage.getItem(KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map(p => window.CertData.createProject(p));
          const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(cleaned) : cleaned;
          if (window.Scheduler) {
            const range = window.Scheduler.getTimelineRange(sorted);
            if (range.startWeek && range.endWeek) {
              return sorted;
            }
          } else {
            return sorted;
          }
        }
      }
    } catch (e) {
      console.warn('localStorage data invalid, restoring defaults:', e);
    }

    return this.resetToDefault();
  },

  saveProjects(projects) {
    try {
      const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(projects) : projects;
      localStorage.setItem(KEY, JSON.stringify(sorted));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  saveAsDefault(projects) {
    try {
      const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(projects) : projects;
      localStorage.setItem(DEFAULT_KEY, JSON.stringify(sorted));
      localStorage.setItem(KEY, JSON.stringify(sorted));
      return sorted;
    } catch (e) {
      console.error('Failed to save custom default:', e);
    }
  },

  async fetchDefaultProjects() {
    try {
      const res = await fetch('default-projects.json?t=' + Date.now());
      if (res.ok) {
        const parsed = await res.json();
        let items = parsed;
        if (items && !Array.isArray(items)) {
          if (Array.isArray(items.projects)) items = items.projects;
          else if (Array.isArray(items.data)) items = items.data;
          else if (Array.isArray(items.items)) items = items.items;
        }
        if (Array.isArray(items) && items.length > 0) {
          const cleaned = items.map(p => window.CertData.createProject(p));
          return window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(cleaned) : cleaned;
        }
      }
    } catch (e) {
      console.log('Using default JS fallback for projects:', e);
    }
    const defaults = window.CertData.DEFAULT_PROJECTS.map(p => window.CertData.createProject(p));
    return window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(defaults) : defaults;
  },

  resetToDefault() {
    try {
      const customDefault = localStorage.getItem(DEFAULT_KEY);
      if (customDefault) {
        const parsed = JSON.parse(customDefault);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map(p => window.CertData.createProject(p));
          const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(cleaned) : cleaned;
          localStorage.setItem(KEY, JSON.stringify(sorted));
          return sorted;
        }
      }
    } catch (e) {}

    const defaults = window.CertData.DEFAULT_PROJECTS.map(p => window.CertData.createProject(p));
    const sortedDefaults = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(defaults) : defaults;
    try {
      localStorage.setItem(KEY, JSON.stringify(sortedDefaults));
    } catch (e) {}

    // Async check to load default-projects.json if available
    this.fetchDefaultProjects().then(fetched => {
      if (fetched && fetched.length > 0 && !localStorage.getItem(DEFAULT_KEY)) {
        this.saveProjects(fetched);
        if (window.GanttRenderer && window.App) {
          window.App.projects = fetched;
          window.GanttRenderer.renderGantt(fetched);
        }
      }
    });

    return sortedDefaults;
  },

  exportJSON(projects) {
    const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(projects) : projects;
    const blob = new Blob([JSON.stringify(sorted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cert-planner-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let parsed = JSON.parse(e.target.result);
          if (parsed && !Array.isArray(parsed)) {
            if (Array.isArray(parsed.projects)) parsed = parsed.projects;
            else if (Array.isArray(parsed.data)) parsed = parsed.data;
            else if (Array.isArray(parsed.items)) parsed = parsed.items;
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed.map(p => window.CertData.createProject(p));
            const sorted = window.CertData.sortProjectsByRegion ? window.CertData.sortProjectsByRegion(cleaned) : cleaned;
            this.saveProjects(sorted);
            resolve(sorted);
          } else {
            reject(new Error('JSON 文件中未找到有效的项目列表'));
          }
        } catch (err) {
          reject(new Error('JSON 解析失败: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
};

window.Storage = Storage;
