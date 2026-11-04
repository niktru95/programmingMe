/* app.js — интерфейс приложения: рендер, навигация, перемешивание задач, прогресс. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function fmt(v) {
    if (typeof v === 'undefined') return 'undefined';
    if (typeof v === 'number' && Number.isNaN(v)) return 'NaN';
    if (v === Infinity) return 'Infinity';
    if (v === -Infinity) return '-Infinity';
    if (typeof v === 'string') return '"' + v + '"';
    if (typeof v === 'function') return 'ƒ()';
    if (typeof v === 'boolean' || v === null) return String(v);
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function fmtArgs(args) {
    return (args || []).map(fmt).join(', ');
  }

  var DIFF = {
    1: { label: 'Легко', cls: 'diff-1' },
    2: { label: 'Средне', cls: 'diff-2' },
    3: { label: 'Сложно', cls: 'diff-3' }
  };

  /* Собирает тесты задачи. Поддерживает: task.tests, task.gen (случайная генерация),
     и сокращённый формат task.run/task.expected (+ task.run2/task.expected2) */
  function buildTests(task) {
    if (typeof task.gen === 'function') return task.gen();
    var tests = (task.tests || []).slice();
    if (task.run !== undefined) {
      tests.push({ run: task.run, expected: task.expected });
      if (task.run2 !== undefined) tests.push({ run: task.run2, expected: task.expected2 });
    }
    return tests;
  }

  /* Сессионная БД: тестовые данные для задач с генератором создаются один раз за загрузку страницы */
  var SessionDB = TasksDB.map(function (topic) {
    return {
      id: topic.id, title: topic.title, icon: topic.icon, description: topic.description,
      theory: topic.theory,
      tasks: topic.tasks.map(function (task) {
        return {
          id: task.id, title: task.title, difficulty: task.difficulty, description: task.description,
          functionName: task.functionName, starterCode: task.starterCode, hints: task.hints,
          solution: task.solution, solutionNote: task.solutionNote,
          tests: buildTests(task)
        };
      })
    };
  });

  window.SessionDB = SessionDB; // для selftest

  var getTopic = function (id) { return SessionDB.filter(function (t) { return t.id === id; })[0]; };
  var getTask = function (topicId, taskId) {
    var t = getTopic(topicId);
    if (!t) return null;
    return t.tasks.filter(function (x) { return x.id === taskId; })[0] || null;
  };

  var state = {
    topicId: null,
    taskId: null,
    order: [],
    index: 0,
    filter: 'all',
    hintsShown: {}
  };

  /* ---------- Прогресс ---------- */
  function totals() {
    var solved = 0, total = 0;
    SessionDB.forEach(function (topic) {
      topic.tasks.forEach(function (task) {
        total++;
        if (Storage.isSolved(task.id)) solved++;
      });
    });
    return { solved: solved, total: total };
  }

  function renderGlobalProgress() {
    var t = totals();
    var pct = t.total ? Math.round(t.solved / t.total * 100) : 0;
    $('#global-progress').innerHTML =
      '<div class="gprog-bar"><div class="gprog-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="gprog-text">' + t.solved + ' / ' + t.total + ' решено</span>';
  }

  /* ---------- Представления ---------- */
  function showView(name) {
    ['home', 'topic', 'task'].forEach(function (v) {
      $('#view-' + v).classList.toggle('hidden', v !== name);
    });
    window.scrollTo(0, 0);
  }

  function renderHome() {
    $('#topics-grid').innerHTML = SessionDB.map(function (topic) {
      var solved = topic.tasks.filter(function (t) { return Storage.isSolved(t.id); }).length;
      var pct = Math.round(solved / topic.tasks.length * 100);
      return '<a class="topic-card" href="#t-' + topic.id + '">' +
        '<div class="topic-icon">' + topic.icon + '</div>' +
        '<div class="topic-body">' +
        '<div class="topic-name">' + esc(topic.title) + '</div>' +
        '<div class="topic-desc">' + esc(topic.description) + '</div>' +
        '<div class="topic-progress-row">' +
        '<div class="prog-bar"><div class="prog-fill" style="width:' + pct + '%"></div></div>' +
        '<span>' + solved + ' / ' + topic.tasks.length + '</span>' +
        '</div></div></a>';
    }).join('');
    renderGlobalProgress();
  }

  /* ---------- Тема ---------- */
  function openTopic(topicId) {
    var topic = getTopic(topicId);
    if (!topic) { location.hash = ''; return; }
    state.topicId = topicId;
    state.taskId = null;
    state.filter = 'all';
    state.order = shuffle(topic.tasks.map(function (t) { return t.id; }));
    state.index = 0;
    renderTopic();
    showView('topic');
  }

  function renderTopic() {
    var topic = getTopic(state.topicId);
    $('#topic-title').textContent = topic.title;
    $('#topic-description').textContent = topic.description;
    var solved = topic.tasks.filter(function (t) { return Storage.isSolved(t.id); }).length;
    var pct = Math.round(solved / topic.tasks.length * 100);
    $('#topic-progress').innerHTML =
      '<div class="prog-bar wide"><div class="prog-fill" style="width:' + pct + '%"></div></div>' +
      '<span>Решено: ' + solved + ' из ' + topic.tasks.length + '</span>';

    $('#topic-filters').innerHTML =
      '<button class="chip' + (state.filter === 'all' ? ' active' : '') + '" data-filter="all">Все (' + topic.tasks.length + ')</button>' +
      '<button class="chip' + (state.filter === 'solved' ? ' active' : '') + '" data-filter="solved">Решённые</button>' +
      '<button class="chip' + (state.filter === 'unsolved' ? ' active' : '') + '" data-filter="unsolved">Нерешённые</button>';

    var orderMap = {};
    state.order.forEach(function (id, i) { orderMap[id] = i; });
    var tasks = topic.tasks
      .filter(function (t) {
        if (state.filter === 'solved') return Storage.isSolved(t.id);
        if (state.filter === 'unsolved') return !Storage.isSolved(t.id);
        return true;
      })
      .sort(function (a, b) { return orderMap[a.id] - orderMap[b.id]; });

    $('#task-list').innerHTML = tasks.map(function (t, idx) {
      var d = DIFF[t.difficulty] || DIFF[1];
      var st = Storage.isSolved(t.id) ? (Storage.isHinted(t.id) ? '✨' : '✅') : '⬜';
      return '<a class="task-item" href="#task-' + topic.id + '/' + t.id + '">' +
        '<span class="task-item-num">' + (idx + 1) + '</span>' +
        '<span class="task-item-name">' + esc(t.title) + '</span>' +
        '<span class="badge ' + d.cls + '">' + d.label + '</span>' +
        '<span class="task-item-status">' + st + '</span></a>';
    }).join('');
    if (!tasks.length) $('#task-list').innerHTML = '<div class="empty">В этой категории нет задач 🎉</div>';
    renderGlobalProgress();
  }

  /* ---------- Задача ---------- */
  function openTask(topicId, taskId) {
    var task = getTask(topicId, taskId);
    if (!task) { openTopic(topicId); return; }
    state.topicId = topicId;
    state.taskId = taskId;
    state.hintsShown[taskId] = 0;

    var sol = $('#solution-block');
    if (sol) sol.remove();
    clearResults();

    var draft = Storage.getDraft(taskId);
    $('#code-editor').value = draft || task.starterCode;
    $('#task-title').textContent = task.title;
    $('#task-description').innerHTML = formatDescription(task.description);
    $('#task-topic-label').textContent = getTopic(topicId).title;
    var d = DIFF[task.difficulty] || DIFF[1];
    var badge = $('#task-difficulty');
    badge.textContent = d.label;
    badge.className = 'badge ' + d.cls;
    renderTaskStatus(task);
    renderHints(task);
    showView('task');
  }

  function formatDescription(desc) {
    return String(desc).split('\n').map(function (line) {
      var m = line.match(/^(#{1,3})\s+(.*)/);
      if (m) return '<h4>' + esc(m[2]) + '</h4>';
      if (line.trim() === '') return '';
      if (/^[-*]\s+/.test(line)) return '<p class="desc-li">• ' + esc(line.slice(2)) + '</p>';
      if (/^\d+\.\s+/.test(line)) return '<p class="desc-li">' + esc(line) + '</p>';
      if (/```/.test(line)) return '<pre class="inline-code">' + esc(line.replace(/```/g, '')) + '</pre>';
      return '<p>' + esc(line) + '</p>';
    }).join('');
  }

  function renderTaskStatus(task) {
    var st = $('#task-status');
    if (Storage.isSolved(task.id)) {
      st.textContent = Storage.isHinted(task.id) ? '✨ Решена (с подсказкой)' : '✅ Решена';
      st.className = 'task-status solved';
    } else {
      st.textContent = '⬜ Не решена';
      st.className = 'task-status';
    }
  }

  function renderHints(task) {
    var shown = state.hintsShown[task.id] || 0;
    if (!task.hints || !task.hints.length) {
      $('#btn-hint').classList.add('hidden');
      $('#hints-block').innerHTML = '';
      return;
    }
    $('#btn-hint').classList.remove('hidden');
    $('#hints-block').innerHTML = task.hints.slice(0, shown).map(function (h, i) {
      return '<div class="hint">💡 Подсказка ' + (i + 1) + ': ' + esc(h) + '</div>';
    }).join('');
  }

  function showNextHint(task) {
    if (!task.hints || !task.hints.length) return;
    var shown = state.hintsShown[task.id] || 0;
    if (shown < task.hints.length) {
      state.hintsShown[task.id] = shown + 1;
      if (!Storage.isSolved(task.id)) Storage.setHinted(task.id, true);
      renderHints(task);
      renderTaskStatus(task);
    }
  }

  function clearResults() {
    $('#results-card').classList.add('hidden');
    $('#console-block').classList.add('hidden');
    $('#console-output').textContent = '';
  }

  /* ---------- Запуск и результаты ---------- */
  function currentTask() { return getTask(state.topicId, state.taskId); }

  function runCurrent() {
    var task = currentTask();
    var btn = $('#btn-run');
    if (!task || btn.disabled || $('#view-task').classList.contains('hidden')) return;
    var code = $('#code-editor').value;
    Storage.setDraft(task.id, code);
    btn.disabled = true;
    btn.textContent = '⏳ Проверка...';
    Runner.run(task, code, function (res) {
      btn.disabled = false;
      btn.textContent = '▶ Выполнить';
      renderResults(task, res);
    });
  }

  function renderResults(task, res) {
    $('#results-card').classList.remove('hidden');
    if (res.logs && res.logs.length) {
      $('#console-block').classList.remove('hidden');
      $('#console-output').textContent = res.logs.join('\n');
    } else {
      $('#console-block').classList.add('hidden');
    }

    if (!res.ok) {
      $('#results-summary').innerHTML = '<div class="summary-error">❌ Ошибка выполнения</div>';
      $('#results-list').innerHTML = '<div class="result fail"><div class="result-msg">' + esc(res.error) + '</div></div>';
      return;
    }

    var passed = res.results.filter(function (r) { return r.pass; }).length;
    var all = res.results.length;
    var ok = passed === all;
    $('#results-summary').innerHTML = ok
      ? '<div class="summary-ok">🎉 Все ' + all + ' из ' + all + ' тестов пройдено — задача решена!</div>'
      : '<div class="summary-partial">' + passed + ' из ' + all + ' тестов пройдено</div>';

    $('#results-list').innerHTML = res.results.map(function (r, i) {
      var inStr;
      if (r.type === 'run') inStr = ' (проверка-функция)';
      else if (r.type === 'steps') inStr = ' ' + r.input.map(function (args) { return '(' + fmtArgs(args) + ')'; }).join('');
      else inStr = ' (' + fmtArgs(r.input) + ')';
      return '<div class="result ' + (r.pass ? 'pass' : 'fail') + '">' +
        '<div class="result-head">' + (r.pass ? '✅' : '❌') + ' Тест ' + (i + 1) +
        '<span class="result-input">' + esc(inStr) + '</span></div>' +
        (r.error
          ? '<div class="result-msg">Ошибка: ' + esc(r.error) + '</div>'
          : '<div class="result-line">Получено: <code>' + esc(r.actualText !== undefined ? r.actualText : fmt(r.actual)) + '</code></div>' +
            '<div class="result-line">Ожидалось: <code>' + esc(fmt(r.expected)) + '</code></div>') +
        '</div>';
    }).join('');

    if (ok) {
      Storage.setSolved(task.id, true);
      renderTaskStatus(task);
      renderGlobalProgress();
    }
  }

  /* ---------- Навигация ---------- */
  function navigate() {
    var hash = location.hash;
    if (/^#task-/.test(hash)) {
      var m = hash.match(/^#task-([^/]+)\/(.+)$/);
      if (m) {
        var topic = getTopic(m[1]);
        if (topic) {
          if (state.topicId !== m[1]) {
            state.topicId = m[1];
            state.order = shuffle(topic.tasks.map(function (t) { return t.id; }));
          }
          var idx = state.order.indexOf(m[2]);
          if (idx < 0) { state.order.push(m[2]); idx = state.order.length - 1; }
          state.index = idx;
          openTask(m[1], m[2]);
          renderGlobalProgress();
          return;
        }
      }
    }
    if (/^#t-/.test(hash)) {
      var id = hash.slice(3);
      if (getTopic(id)) { openTopic(id); return; }
    }
    renderHome();
    showView('home');
  }

  /* ---------- Модальное окно ---------- */
  var modalAction = null;
  function openModal(title, body, action) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    modalAction = action;
    $('#modal-backdrop').classList.remove('hidden');
  }
  function closeModal(confirmed) {
    $('#modal-backdrop').classList.add('hidden');
    if (confirmed && modalAction) modalAction();
    modalAction = null;
  }

  function showSolution(task) {
    var existing = $('#solution-block');
    if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = 'solution-block';
    wrap.innerHTML =
      '<h4 class="solution-title">📖 Авторское решение</h4>' +
      '<pre class="solution-code">' + esc(task.solution) + '</pre>' +
      (task.solutionNote ? '<p class="solution-note">' + esc(task.solutionNote) + '</p>' : '');
    document.querySelector('.task-card').appendChild(wrap);
    if (!Storage.isSolved(task.id)) Storage.setHinted(task.id, true);
    renderTaskStatus(task);
    renderGlobalProgress();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Теория ---------- */
  function openTheory(topicId) {
    var topic = getTopic(topicId);
    if (!topic || !topic.theory || !topic.theory.length) return;
    $('#theory-topic-title').textContent = topic.title;
    $('#theory-topic-icon').textContent = topic.icon;
    $('#theory-content').innerHTML = topic.theory.map(function (sec, i) {
      return '<div class="theory-section"><h3 class="theory-h">' + (i + 1) + '. ' + esc(sec.h) + '</h3>' +
        formatDescription(sec.text) +
        (sec.code ? '<pre class="inline-code">' + esc(sec.code) + '</pre>' : '') +
        '</div>';
    }).join('');
    $('#theory-backdrop').classList.remove('hidden');
  }

  function closeTheory() {
    $('#theory-backdrop').classList.add('hidden');
  }

  /* ---------- События ---------- */
  function bindEvents() {
    $('#btn-home').addEventListener('click', function () { location.hash = ''; });
    $('#btn-back-home').addEventListener('click', function () { location.hash = ''; });
    $('#btn-back-topic').addEventListener('click', function () { location.hash = '#t-' + state.topicId; });

    $('#btn-shuffle').addEventListener('click', function () {
      var topic = getTopic(state.topicId);
      if (!topic) return;
      state.order = shuffle(topic.tasks.map(function (t) { return t.id; }));
      renderTopic();
    });

    $('#btn-shuffle-task').addEventListener('click', function () {
      var topic = getTopic(state.topicId);
      if (!topic || topic.tasks.length < 2) return;
      var idx;
      do { idx = Math.floor(Math.random() * topic.tasks.length); } while (idx === state.index);
      location.hash = '#task-' + state.topicId + '/' + state.order[idx];
    });

    $('#btn-next-task').addEventListener('click', function () {
      var topic = getTopic(state.topicId);
      if (!topic) return;
      state.index = (state.index + 1) % state.order.length;
      location.hash = '#task-' + state.topicId + '/' + state.order[state.index];
    });

    $('#btn-run').addEventListener('click', runCurrent);

    $('#btn-reset').addEventListener('click', function () {
      var task = currentTask();
      $('#code-editor').value = task.starterCode;
      Storage.setDraft(task.id, task.starterCode);
      clearResults();
    });

    $('#btn-hint').addEventListener('click', function () { showNextHint(currentTask()); });

    $('#btn-solution').addEventListener('click', function () {
      var note = Storage.isSolved(currentTask().id) ? 'Задача уже решена — статус не изменится.' : 'Задача будет отмечена как «решена с подсказкой» ✨';
      openModal('Показать решение?', note, function () {
        showSolution(currentTask());
      });
    });

    $('#btn-theory').addEventListener('click', function () { openTheory(state.topicId); });
    $('#btn-theory-task').addEventListener('click', function () { openTheory(state.topicId); });
    $('#theory-close').addEventListener('click', closeTheory);
    $('#theory-start').addEventListener('click', closeTheory);
    $('#theory-backdrop').addEventListener('click', function (e) { if (e.target === $('#theory-backdrop')) closeTheory(); });

    $('#topic-filters').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (btn) { state.filter = btn.getAttribute('data-filter'); renderTopic(); }
    });

    var timer = null;
    $('#code-editor').addEventListener('input', function () {
      /* Задачу и код фиксируем сразу: если за 400 мс перейти к другой задаче, черновик не перепутается */
      var task = currentTask(), code = this.value;
      clearTimeout(timer);
      timer = setTimeout(function () { if (task) Storage.setDraft(task.id, code); }, 400);
    });

    $('#modal-ok').addEventListener('click', function () { closeModal(true); });
    $('#modal-cancel').addEventListener('click', function () { closeModal(false); });
    $('#modal-backdrop').addEventListener('click', function (e) { if (e.target === $('#modal-backdrop')) closeModal(false); });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runCurrent();
      if (e.key === 'Escape') { closeModal(false); closeTheory(); }
    });

    window.addEventListener('hashchange', navigate);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    navigate();
  });
})();
