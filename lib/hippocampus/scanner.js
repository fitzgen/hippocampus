define(function (require, exports, module) {

  var errors = require('hippocampus/errors');

  var tokens = [];
  var tokensLength = 0;

  function defToken (tokenName, regexp) {
    tokensLength++;
    tokens.push({
      name: tokenName,
      regexp: regexp
    });
  }

  defToken('OPEN_PAREN', /^\(/);
  defToken('CLOSE_PAREN', /^\)/);
  defToken('OPEN_BRACKET', /^\[/);
  defToken('CLOSE_BRACKET', /^\]/);
  defToken('OPEN_BRACE', /^\{/);
  defToken('CLOSE_BRACE', /^\}/);
  defToken('NUMBER', /^[+-]?\d*\.?\d+/);
  defToken('SYMBOL', /^[+\-a-zA-Z0-9$><=!?*\/@#%^&_|~:]+/);
  defToken('STRING', /^"[^\n]*?[^\\]"/);
  // defToken('QUOTE', /^'/);
  // defToken('QUASIQUOTE', /^`/);

  function tokenize (source, file) {
    file = file || '(unknown file)';

    var line = 1;
    var column = 0;

    var i = 0;
    var j;
    var len = source.length;
    var match;

    var tokenStream = [];

    while ( i < len) {
      if ( source.charAt(i) === '\n' ) {
        line++;
        column = 0;
        i++;
      } else if ( /^\s/.test(source.charAt(i)) ) {
        column++;
        i++;
      } else if ( source.charAt(i) === ';' ) {
        while ( i < len && source.charAt(i) !== '\n' ) {
          i++;
        }
        line++;
        column = 0;
      } else {
        for ( j = 0; j < tokensLength; j++ ) {
          match = source.slice(i).match(tokens[j].regexp);
          if ( match ) {
            tokenStream.push({
              type: tokens[j].name,
              value: match[0],
              line: line,
              column: column
            });
            column += match[0].length;
            i += match[0].length;
            break;
          }
        }

        if ( ! match ) {
          console.error(source.slice(i));
          throw new errors.SyntaxError(file, line, column);
        }
      }
    }

    return tokenStream;
  };

  exports.tokenize = tokenize;

});
