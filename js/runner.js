/* Runner — песочница: код пользователя выполняется в отдельном iframe (sandbox=allow-scripts),
   чтобы ошибки в решении не влияли на само приложение. */
var Runner = {

  deepEqual: function (a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!this.deepEqual(a[i], b[i])) return false;
      return true;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) {
        var k = ka[j];
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!this.deepEqual(a[k], b[k])) return false;
      }
      return true;
    }
    return false;
  },

  /* task: объект задачи, code: код пользователя, onDone: обработчик результата */
  run: function (task, code, onDone) {
    var iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('srcdoc', this.buildHarness(task, code));
    var handler = function (e) {
      if (e.source !== iframe.contentWindow) return;
      window.removeEventListener('message', handler);
      iframe.remove();
      onDone(e.data);
    };
    window.addEventListener('message', handler);
    document.body.appendChild(iframe);
  },

  buildHarness: function (task, code) {
    var userCode = String(code || '').replace(/<\/script>/gi, '<\\/script>');
    var fnName = task.functionName;
    var tests = JSON.stringify(task.tests || []).replace(/<\/script>/gi, '<\\/script>');
    return [
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>',
      '<script>',
      'var __logs = [];',
      'var __origLog = console.log;',
      'console.log = function () {',
      '  var args = Array.prototype.slice.call(arguments);',
      '  __logs.push(args.map(function (a) { if (typeof a === "string") return a; try { return JSON.stringify(a); } catch (e) { return String(a); } }).join(" "));',
      '  __origLog.apply(console, arguments);',
      '};',
      'function __post(obj) { parent.postMessage(obj, "*"); }',
      'function __deepEqual(a, b) {',
      '  if (a === b) return true;',
      '  if (typeof a === "number" && typeof b === "number" && isNaN(a) && isNaN(b)) return true;',
      '  if (Array.isArray(a) && Array.isArray(b)) {',
      '    if (a.length !== b.length) return false;',
      '    for (var i = 0; i < a.length; i++) if (!__deepEqual(a[i], b[i])) return false;',
      '    return true;',
      '  }',
      '  if (a && b && typeof a === "object" && typeof b === "object") {',
      '    var ka = Object.keys(a);',
      '    if (ka.length !== Object.keys(b).length) return false;',
      '    for (var j = 0; j < ka.length; j++) {',
      '      var k = ka[j];',
      '      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;',
      '      if (!__deepEqual(a[k], b[k])) return false;',
      '    }',
      '    return true;',
      '  }',
      '  return false;',
      '}',
      'function __describe(t) {',
      '  if (t.input !== undefined) return { type: "input", value: t.input };',
      '  if (t.steps) return { type: "steps", value: t.steps };',
      '  if (t.run) return { type: "run", value: t.run };',
      '  return { type: "input", value: [] };',
      '}',
      '<\/script>',
      '<script>',
      userCode,
      '<\/script>',
      '<script>',
      'window.onerror = null;',
      'try {',
      '  var __fn = window[' + JSON.stringify(fnName) + '];',
      '  if (typeof __fn !== "function") { try { __fn = eval(' + JSON.stringify(fnName) + '); } catch (e2) {} }',
      '  if (typeof __fn !== "function") throw new Error("Функция «' + fnName + '» не найдена. Проверьте имя функции (нужно определить ' + fnName + ').");',
      '  var __tests = ' + tests + ';',
      '  var __results = [];',
      '  function __next(i) {',
      '    if (i >= __tests.length) { __post({ ok: true, results: __results, logs: __logs }); return; }',
      '    var t = __tests[i];',
      '    var d = __describe(t);',
      '    try {',
      '      var out;',
      '      if (d.type === "input") out = __fn.apply(null, d.value);',
      '      else if (d.type === "steps") {',
      '        var v = __fn.apply(null, d.value[0]);',
      '        for (var s = 1; s < d.value.length; s++) v = v.apply(null, d.value[s]);',
      '        out = v;',
      '      } else {',
      '        out = eval("(" + d.value + ")")(__fn);',
      '      }',
      '      Promise.resolve(out).then(function (v) {',
      '        __results.push({ input: d.value, expected: t.expected, actual: v, pass: __deepEqual(v, t.expected) });',
      '        __next(i + 1);',
      '      }).catch(function (err) {',
      '        __results.push({ input: d.value, expected: t.expected, error: String(err && err.message || err), pass: false });',
      '        __next(i + 1);',
      '      });',
      '    } catch (err) {',
      '      __results.push({ input: d.value, expected: t.expected, error: String(err && err.message || err), pass: false });',
      '      __next(i + 1);',
      '    }',
      '  }',
      '  __next(0);',
      '} catch (err) {',
      '  __post({ ok: false, error: String(err && err.message || err) });',
      '}',
      '<\/script>',
      '</body></html>'
    ].join('\n');
  }
};