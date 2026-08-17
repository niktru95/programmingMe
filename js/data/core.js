/* core.js — основа базы задач.
   Темы добавляются в TasksDB: TasksDB.push({ id, title, icon, description, tasks: [...] }).

   Задача:
   { id, title, difficulty: 1|2|3, description, functionName, starterCode,
     tests: [ { input: [...], expected: ... }  |  { steps: [[..],[..]], expected: ... }  |  { run: '(fn) => ...', expected: ... } ]
       ЛИБО gen: function () { return [...]; } — случайные тесты при каждой загрузке страницы,
     hints: [...], solution, solutionNote }
*/

var TasksDB = [];

/* Случайные утилиты для генераторов тестов */
function rnd(n) { return Math.floor(Math.random() * n); }
function rndInt(min, max) { return min + rnd(max - min + 1); }
function rndArr(len, min, max) { var a = []; for (var i = 0; i < len; i++) a.push(rndInt(min, max)); return a; }function sumArr(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s; }
function prodArr(arr) { var p = 1; for (var i = 0; i < arr.length; i++) p *= arr[i]; return p; }
function minArr(arr) { return Math.min.apply(null, arr); }
function maxArr(arr) { return Math.max.apply(null, arr); }
function avgArr(arr) { return arr.length ? sumArr(arr) / arr.length : 0; }
function copyArr(arr) { return arr.slice(); }