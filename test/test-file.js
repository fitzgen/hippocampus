// test/test-file.hc
define(function (require, exports, module) {
  var number = 42;

  var opposite = false;

  opposite = true;

  if (opposite) {
    number = -42;
  }

  function square(x) {
    return (x * x);
  }

  console.log(number);

  (function (number, another) {
    console.log(number);
  }((number + 10), 1))

  console.log(number);

  var cubes = (function () {
      var _results1 = [];
      var n;
      var _array1 = list;
      for (var _i1 = 0, _len1 = _array1.length; _i1 < _len1; _i1++) {
        n = _array1[_i1];
        _results1.push(math.cube(n));
      }
      return _results1;
    }());
});

