define(function (require, exports, module) {

  var fs;
  try {
    fs = require('fs');
  } catch (e) {}

  var parser = require('hippocampus/parser');
  var scanner = require('hippocampus/scanner');

  function compile (source, optionalFilename, optionalIndentation) {
    var indent = optionalIndentation || 2;
    var tokens = scanner.tokenize(source);
    return (new parser.Module(tokens, optionalFilename)).compile(2);
  }
  exports.compile = compile;

  function compileFile (file, cb) {
    if ( fs ) {
      fs.readFile(file, 'utf8', function (err, data) {
        if ( err ) {
          cb(err, null);
        } else {
          try {
            cb(null, compile(data, file, 2));
          } catch (e) {
            cb(e, null);
          }
        }
      });
    } else {
      throw new Error('fs module not available');
    }
  }
  exports.compileFile = compileFile;

  function compileFileSync (file, optionalIndentation) {
    if ( fs ) {
      return compile(fs.readFileSync(file, 'utf8'),
                     file,
                     optionalIndentation)
    } else {
      throw new Error('fs module not available');
    }
  }
  exports.compileFileSync = compileFileSync;

});
