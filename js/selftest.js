/* selftest.js — автотест приложения (запускается при ?selftest).
   Прогоняет песочницу на правильном и неверном коде, проверяет deepEqual.
   Результат пишется в document.title: SELFTEST-OK или SELFTEST-FAIL: ... */
(function () {
  if (location.search.indexOf('selftest') < 0) return;
  var results = [];
  function check(name, cond) { results.push({ name: name, ok: !!cond }); render(); }
  function render() {
    var div = document.getElementById('selftest-result');
    if (!div) { div = document.createElement('div'); div.id = 'selftest-result'; document.body.appendChild(div); }
    div.textContent = results.map(function (r) { return (r.ok ? 'OK ' : 'FAIL ') + r.name; }).join('; ');
  }
  function finish() {
    var failed = results.filter(function (r) { return !r.ok; });
    document.title = failed.length
      ? 'SELFTEST-FAIL: ' + failed.map(function (f) { return f.name; }).join(', ')
      : 'SELFTEST-OK';
    render();
  }

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
    check('data-9-topics', TasksDB.length === 9);
    var totalTasks = 0, badDiff = 0;
    TasksDB.forEach(function (topic) {
      totalTasks += topic.tasks.length;
      topic.tasks.forEach(function (t) { if (!t.difficulty || t.difficulty < 1 || t.difficulty > 3) badDiff++; });
    });
    check('data-270-tasks', totalTasks === 270);
    check('data-difficulties-ok', badDiff === 0);

    var syncTask = {
      id: 'st-sync', functionName: 'sum',
      tests: [{ input: [[1, 2, 3]], expected: 6 }, { input: [[]], expected: 0 }]
    };
    var stepsTask = {
      id: 'st-steps', functionName: 'makeCounter',
      tests: [{ steps: [[], []], expected: 0 }]
    };
    var asyncTask = {
      id: 'st-async', functionName: 'doubleAsync',
      tests: [{ input: [5], expected: 10 }]
    };

    /* Пять проверок песочницы запускаем параллельно, чтобы не зависеть от вложенности iframe */
    var pending = 5;
    function stepDone() { if (--pending === 0) finish(); }

    Runner.run(syncTask, 'function sum(arr) { return arr.reduce(function(a, b) { return a + b; }, 0); }', function (r1) {
      check('sync-correct', r1.ok && r1.results.every(function (r) { return r.pass; }));
      stepDone();
    });
    Runner.run(syncTask, 'function sum(arr) { return 42; }', function (r2) {
      check('sync-wrong', r2.ok && !r2.results.every(function (r) { return r.pass; }));
      stepDone();
    });
    Runner.run(stepsTask, 'function makeCounter() { var n = 0; return function () { return n++; }; }', function (r3) {
      check('steps-correct', r3.ok && r3.results[0].pass);
      stepDone();
    });
    Runner.run(asyncTask, 'function doubleAsync(x) { return Promise.resolve(x * 2); }', function (r4) {
      check('async-correct', r4.ok && r4.results[0].pass);
      stepDone();
    });
    Runner.run(syncTask, 'function wrong() {}', function (r5) {
      check('missing-function', r5.ok === false && r5.error.indexOf('не найдена') >= 0);
      stepDone();
    });

    /* Страж: если что-то по какой-то причине не завершилось, всё равно фиксируем результат */
    setTimeout(finish, 12000);
  });
})();