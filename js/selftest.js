/* selftest.js — автотест приложения (запускается при ?selftest).
   Проверяет deepEqual, песочницу на правильном/неверном/зависающем коде и то,
   что авторское решение каждой задачи проходит её тесты, а заготовка — нет.
   Результат пишется в document.title: SELFTEST-OK или SELFTEST-FAIL: ... */
(function () {
  if (location.search.indexOf('selftest') < 0) return;
  var results = [];
  var done = false;
  function check(name, cond) { results.push({ name: name, ok: !!cond }); render(); }
  function render() {
    var div = document.getElementById('selftest-result');
    if (!div) { div = document.createElement('div'); div.id = 'selftest-result'; document.body.appendChild(div); }
    div.textContent = results.map(function (r) { return (r.ok ? 'OK ' : 'FAIL ') + r.name; }).join('; ');
  }
  function finish() {
    if (done) return;
    done = true;
    var failed = results.filter(function (r) { return !r.ok; });
    document.title = failed.length
      ? 'SELFTEST-FAIL: ' + failed.map(function (f) { return f.name; }).join(', ')
      : 'SELFTEST-OK';
    render();
  }
  function allPass(r) { return r.ok && r.results.every(function (x) { return x.pass; }); }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(function () {
    check('deepEqual-simple', Runner.deepEqual(1, 1));
    check('deepEqual-nan', Runner.deepEqual(NaN, NaN));
    check('deepEqual-array-nested', Runner.deepEqual([1, [2, 3]], [1, [2, 3]]));
    check('deepEqual-object', Runner.deepEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } }));
    check('deepEqual-negative', !Runner.deepEqual([1, 2], [1, 3]));
    check('deepEqual-array-vs-object', !Runner.deepEqual([1], { 0: 1 }));
    check('deepEqual-set', !Runner.deepEqual(new Set([1]), new Set([2])));
    check('data-13-topics', TasksDB.length === 13);
    var totalTasks = 0, badDiff = 0;
    TasksDB.forEach(function (topic) {
      totalTasks += topic.tasks.length;
      topic.tasks.forEach(function (t) { if (!t.difficulty || t.difficulty < 1 || t.difficulty > 3) badDiff++; });
    });
    check('data-390-tasks', totalTasks === 390);
    check('data-difficulties-ok', badDiff === 0);

    var syncTask = { id: 'st-sync', functionName: 'sum', tests: [{ input: [[1, 2, 3]], expected: 6 }, { input: [[]], expected: 0 }] };
    var stepsTask = { id: 'st-steps', functionName: 'makeCounter', tests: [{ steps: [[], []], expected: 0 }] };
    var asyncTask = { id: 'st-async', functionName: 'doubleAsync', tests: [{ input: [5], expected: 10 }] };

    /* Очередь проверок: [задача, код, проверка результата]. Выполняются по одной. */
    var queue = [
      [syncTask, 'function sum(arr) { return arr.reduce(function(a, b) { return a + b; }, 0); }', 'sync-correct', allPass],
      [syncTask, 'const sum = (arr) => arr.reduce((a, b) => a + b, 0);', 'sync-const-arrow', allPass],
      [syncTask, 'function sum(arr) { return 42; }', 'sync-wrong', function (r) { return r.ok && !allPass(r); }],
      [stepsTask, 'function makeCounter() { var n = 0; return function () { return n++; }; }', 'steps-correct', allPass],
      [asyncTask, 'function doubleAsync(x) { return Promise.resolve(x * 2); }', 'async-correct', allPass],
      [syncTask, 'function wrong() {}', 'missing-function', function (r) { return !r.ok && r.error.indexOf('не найдена') >= 0; }],
      [syncTask, 'function sum(arr) { return arr * ; }', 'syntax-error', function (r) { return !r.ok && r.error.indexOf('SyntaxError') >= 0; }],
      [syncTask, 'function sum() { return function () {}; }', 'returns-function', function (r) { return r.ok && r.results[0].actualText === 'ƒ()'; }],
      [syncTask, 'function sum() { while (true) {} }', 'infinite-loop-timeout', function (r) { return !r.ok && r.error.indexOf('остановлен') >= 0; }]
    ];
    /* Авторские решения должны проходить все тесты, а заготовки — нет */
    window.SessionDB.forEach(function (topic) {
      topic.tasks.forEach(function (t) {
        queue.push([t, t.solution, 'solution-' + t.id, allPass]);
        queue.push([t, t.starterCode, 'starter-fails-' + t.id, function (r) { return !allPass(r); }]);
      });
    });

    var total = queue.length;
    (function next() {
      var item = queue.shift();
      if (!item) { finish(); return; }
      Runner.run(item[0], item[1], function (r) {
        check(item[2], item[3](r));
        next();
      });
    })();

    /* Страж: если что-то зависло, незавершённые проверки считаются проваленными */
    setTimeout(function () {
      if (done) return;
      check('selftest-timeout (не выполнено ' + queue.length + ' из ' + total + ')', false);
      finish();
    }, 120000);
  });
})();
