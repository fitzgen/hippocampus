var scanner = require('hippocampus/scanner');
var parser = require('hippocampus/parser');

var input = [
  '(def (call-f-x f x)',
  '  (console:log (if x y z))',
  '  (if (some condition)',
  '    (blah blargh)',
  '    (z otherwise))',
  '  (if (foo bar baz) ff)',
  '  (set! x (if (foo bar baz) ff))',
  '  ;; This is where I use comments',
  '  (let ((x 5)',
  '        (y 4))',
  '    (another-function arg1 arg2)',
  '    (f x)))',
  '',
  '(set! exports:call-f-x call-f-x)',
  '',
  '(set! window:foo (new (FactoryProxyGenerator 1 2) factory))',
  '',
  '(try (divide n 0)',
  '  (catch (exc)',
  '    (recovery exc)',
  '    (further-recovery exc)))',
  '',
  '(for ((x (get-some-list)))',
  '  (console:log x))',
  '',
  '(set! coolness (for ((x (range 0 10))',
  '                     (y (range 0 5))',
  '                     (z (range 0 15)))',
  '                 (console:log (add x y))',
  '                 (multiply x y)))',
  '',
  '(while foo',
  '  (console:log infinity))',
  '',
  '(set! total-info (while information',
  '                   (set! information (run-hooks (get-web-hooks)))',
  '                   (collect information)))',
  '',
  '(Math:max (* 6 7 43 23 4 2 34 449) (- 324 234 432 342 43 342324))',
  '(eq? 5 4)',
  '',
  '(alert (let ((x (+ (* 7 6) 8)))',
  '         (not (eq? x 100))))'
].join('\n');

input.split('\n').forEach(function (line, i) {
  ++i;
  console.log(((i + '').length === 1 ? ' ' : '') + i + ' ' + line);
})
console.log(' ');

var tokens = scanner.tokenize(input);
var module = new parser.Module(tokens, null, 'test-module');
console.log(module.compile(2, {}));
