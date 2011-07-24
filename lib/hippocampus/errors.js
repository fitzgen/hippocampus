define(function (require, exports, module) {

  function HippocampusError (message) {
    Error.call(this, message);
    this.message = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HippocampusError);
    }
  }
  HippocampusError.prototype = Object.create(Error.prototype);
  HippocampusError.prototype.name = 'HippocampusError';
  exports.HippocampusError = HippocampusError;

  function SyntaxError (file, line, column) {
    HippocampusError.call(this, "Syntax error at " + file + ":" + line + ":" + column);
  }
  SyntaxError.prototype = Object.create(HippocampusError.prototype);
  SyntaxError.prototype.name = 'SyntaxError';
  exports.SyntaxError = SyntaxError;

});
