/* Runner — песочница: код пользователя выполняется в отдельном Web Worker.
   Worker не видит страницу, а зависший код (бесконечный цикл, вечный промис) убивается по таймауту. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  var tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (tag === '[object Date]') return a.getTime() === b.getTime();
  if (tag === '[object Map]' || tag === '[object Set]') return deepEqual(Array.from(a), Array.from(b));
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  var ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (var j = 0; j < ka.length; j++) {
    if (!Object.prototype.hasOwnProperty.call(b, ka[j])) return false;
    if (!deepEqual(a[ka[j]], b[ka[j]])) return false;
  }
  return true;
}

/* Тело воркера. Выполняется внутри Worker, поэтому со страницей общается только через сообщения.
   ponytail: служебные функции спрятаны в замыкании, но код пользователя всё ещё может подменить
   встроенные объекты или сам вызвать postMessage — для тренажёра «для себя» этого достаточно. */
function workerHarness() {
  var post = self.postMessage.bind(self);
  var globalEval = eval;

  function describe(t) {
    if (t.input !== undefined) return { type: 'input', value: t.input };
    if (t.steps) return { type: 'steps', value: t.steps };
    if (t.run) return { type: 'run', value: t.run };
    return { type: 'input', value: [] };
  }

  /* Функцию или промис нельзя передать через postMessage — отдаём их текстом */
  function withActual(r, v) {
    try { structuredClone(v); r.actual = v; } catch (e) { r.actualText = typeof v === 'function' ? 'ƒ()' : String(v); }
    return r;
  }

  self.onmessage = function (e) {
    var fnName = e.data.fnName, tests = e.data.tests, logs = [], results = [], fn;
    console.log = function () {
      logs.push(Array.prototype.map.call(arguments, function (a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (err) { return String(a); }
      }).join(' '));
    };
    try {
      /* Глобальный eval: function/var/let/const пользователя видны, а последнее выражение вернёт нужную функцию */
      fn = globalEval(e.data.code + '\n;typeof ' + fnName + ' === "function" ? ' + fnName + ' : undefined');
    } catch (err) {
      post({ ok: false, error: String(err), logs: logs });
      return;
    }
    if (typeof fn !== 'function') {
      post({ ok: false, error: 'Функция «' + fnName + '» не найдена. Проверьте имя функции (нужно определить ' + fnName + ').', logs: logs });
      return;
    }

    function next(i) {
      if (i >= tests.length) { post({ ok: true, results: results, logs: logs }); return; }
      var t = tests[i], d = describe(t), base = { type: d.type, input: d.value, expected: t.expected };
      function fail(err) {
        base.error = String(err && err.message || err);
        base.pass = false;
        results.push(base);
        next(i + 1);
      }
      try {
        var out;
        if (d.type === 'input') out = fn.apply(null, d.value);
        else if (d.type === 'steps') {
          out = fn.apply(null, d.value[0]);
          for (var s = 1; s < d.value.length; s++) out = out.apply(null, d.value[s]);
        } else out = globalEval('(' + d.value + ')')(fn);
        Promise.resolve(out).then(function (v) {
          base.pass = deepEqual(v, t.expected);
          results.push(withActual(base, v));
          next(i + 1);
        }, fail);
      } catch (err) { fail(err); }
    }
    next(0);
  };
}

var Runner = {
  TIMEOUT_MS: 5000,
  deepEqual: deepEqual,
  workerUrl: URL.createObjectURL(new Blob(['(function () {\n' + deepEqual + '\n(' + workerHarness + ')();\n})();'], { type: 'text/javascript' })),

  /* task: объект задачи, code: код пользователя, onDone: обработчик результата */
  run: function (task, code, onDone) {
    var worker = new Worker(this.workerUrl);
    var finished = false;
    var finish = function (res) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      onDone(res);
    };
    var timer = setTimeout(function () {
      finish({ ok: false, error: 'Код выполнялся дольше ' + Runner.TIMEOUT_MS / 1000 + ' с и был остановлен. Возможно, бесконечный цикл или промис, который никогда не завершается.' });
    }, this.TIMEOUT_MS);
    worker.onmessage = function (e) { finish(e.data); };
    worker.onerror = function (e) { e.preventDefault(); finish({ ok: false, error: e.message }); };
    worker.postMessage({ code: String(code || ''), fnName: task.functionName, tests: task.tests || [] });
  }
};
