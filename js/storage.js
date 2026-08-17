/* Сохранение прогресса и черновиков в localStorage */
var Storage = {
  KEY_PROGRESS: 'pm.progress',
  KEY_DRAFTS: 'pm.drafts',

  getProgress: function () {
    try { var p = JSON.parse(localStorage.getItem(this.KEY_PROGRESS)); return p && typeof p === 'object' ? p : {}; }
    catch (e) { return {}; }
  },
  setState: function (taskId, patch) {
    var p = this.getProgress();
    p[taskId] = Object.assign({}, p[taskId] || {}, patch);
    localStorage.setItem(this.KEY_PROGRESS, JSON.stringify(p));
  },
  setSolved: function (taskId, solved) { this.setState(taskId, { solved: !!solved }); },
  setHinted: function (taskId, hinted) { this.setState(taskId, { hinted: !!hinted }); },
  getState: function (taskId) { return this.getProgress()[taskId] || {}; },
  isSolved: function (taskId) { return !!this.getState(taskId).solved; },
  isHinted: function (taskId) { return !!this.getState(taskId).hinted; },

  getDrafts: function () {
    try { var d = JSON.parse(localStorage.getItem(this.KEY_DRAFTS)); return d && typeof d === 'object' ? d : {}; }
    catch (e) { return {}; }
  },
  getDraft: function (taskId) { return this.getDrafts()[taskId]; },
  setDraft: function (taskId, code) {
    var d = this.getDrafts();
    d[taskId] = code;
    localStorage.setItem(this.KEY_DRAFTS, JSON.stringify(d));
  },

  resetAll: function () {
    localStorage.removeItem(this.KEY_PROGRESS);
    localStorage.removeItem(this.KEY_DRAFTS);
  }
};