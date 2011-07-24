define(function (require, exports, module) {

  var gsNames = {};

  function gensym (name) {
    gsNames[name] = gsNames[name] || 0;
    gsNames[name]++;
    return '_' + name + gsNames[name];
  }
  exports.gensym = gensym;

});
