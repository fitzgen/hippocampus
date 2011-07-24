define(function (require, exports, module) {

  // TODO: require() static analysis at compile time?

  var errors = require('hippocampus/errors');
  var scanner = require('hippocampus/scanner');
  var gensym = require('hippocampus/gensym').gensym;

  function consumeType (file, tokens, type) {
    var t = tokens.shift();
    if ( ! t ) {
      throw new errors.SyntaxError(file, 99999999, 99999999);
    } else if ( t.type !== type ) {
      throw new errors.SyntaxError(file, t.line, t.column);
    } else {
      return t;
    }
  }

  function consumeSymbol (file, tokens, symbol) {
    var t = consumeType(file, tokens, 'SYMBOL');
    if ( t.value !== symbol ) {
      throw new errors.SyntaxError(file, t.line, t.column);
    } else {
      return t;
    }
  }

  function consumeExpressions (tokens, file, line, column) {
    var exprs = [];

    do {
      if ( tokens.length === 0 ) {
        throw new errors.SyntaxError(file, line, column);
      } else if ( tokens[0].type === 'CLOSE_PAREN' ) {
        consumeType(file, tokens, 'CLOSE_PAREN');
        break;
      } else {
        exprs.push(new Expression(tokens, file));
        if ( tokens[0] ) {
          line = tokens[0].line;
          column = tokens[0].column;
        }
      }
    } while ( true );

    return exprs;
  }

  function consumeBindings (tokens, file, line, column) {
    var bindings = [];
    var t;

    do {
      if ( tokens.length === 0 ) {
        throw new errors.SyntaxError(file, line, column);
      } else if ( tokens[0].type === 'CLOSE_PAREN' ) {
        consumeType(file, tokens, 'CLOSE_PAREN');
        break;
      } else {
        consumeType(file, tokens, 'OPEN_PAREN');
        bindings.push({
          symbol: new Symbol(tokens, file),
          value: new Expression(tokens, file)
        });
        var t = consumeType(file, tokens, 'CLOSE_PAREN');
        line = t.line;
        column = t.column;
      }
    } while (true);

    return bindings;
  }

  function indentTo (n) {
    var tab = '';
    var i;
    for ( i = 0; i < n; i++ ) {
      tab += ' ';
    }
    return tab;
  }

  function compileParameterList (params, indent, indentStep, sourceMap) {
    return params.map(function (p) {
      return p.compile(true, indent, indentStep, sourceMap).trim();
    }).join(', ');
  }

  function compileBody (body, inExpression, indent, indentStep, sourceMap,
                        continuationStart, continuationEnd) {
    continuationStart = continuationStart || 'return ';
    continuationEnd = continuationEnd || ';';

    var results = [];
    var i;

    for ( i = 0; i < body.length - 1; i++ ) {
      results.push(body[i].compile(false, indent, indentStep, sourceMap));
    }

    // TODO: check if this last expression is an if and then push the return
    // down it.
    if ( inExpression ) {
      results.push(indentTo(indent) + continuationStart
                   + body[body.length-1].compile(true, indent, indentStep, sourceMap).trim()
                   + continuationEnd);
    } else {
      results.push(body[i].compile(false, indent, indentStep, sourceMap));
    }

    return results.join('\n') + '\n';
  }

  function Module (tokens, file, moduleName) {
    this.file = file || '(unknown file)';
    this.moduleName = moduleName || null;
    this.expressions = [];

    while ( tokens.length > 0 ) {
      this.expressions.push(new Expression(tokens, file));
    }
  }

  // TODO: Need to know if the module should be compiled node-style with
  // require() calls inside, or with an array of deps.
  Module.prototype.compile = function Module_compile (indentStep, sourceMap) {
    return 'define(function (require, exports, module) {\n'
      + this.expressions.map(function (e) {
        return e.compile(false, indentStep, indentStep, sourceMap);
      }).join('\n\n')
      + '\n});\n';
  };

  exports.Module = Module;


  function Expression (tokens, file) {
    file = file || '(unknown file)';

    var peek = tokens[0];

    switch ( peek.type ) {
    case 'OPEN_PAREN':
      if ( ! tokens[1] ) {
        throw new errors.SyntaxError(file, peek.line, peek.column);
      }
      peek = tokens[1];
      if ( tokens[1].type !== 'SYMBOL' ) {
        throw new errors.SyntaxError(file, peek.line, peek.column);
      }
      switch ( peek.value ) {
      case 'def':
        return new Definition(tokens, file);
      case 'set!':
        return new Assignment(tokens, file);
      case 'if':
        return new Conditional(tokens, file);
      case 'throw':
        return new Throw(tokens, file);
      case 'try':
        return new Try(tokens, file);
      case 'for':
        return new ListComprehension(tokens, file);
      case 'while':
        return new While(tokens, file);
      case '@':
        return new PropertyAccess(tokens, file);
      case 'let':
        return new Let(tokens, file);
      case 'new':
        return new Instantiation(tokens, file);
      default:
        return new Application(tokens, file);
      }
    case 'OPEN_BRACE':
      return new Object_(tokens, file);
    case 'OPEN_BRACKET':
      return new List(tokens, file);
    case 'NUMBER':
      return new Number_(tokens, file);
    case 'STRING':
      return new String_(tokens, file);
    // case 'QUOTE':
    //   return new QuotedList(tokens, file);
    // case 'QUASIQUOTE':
    //   return new QuasiQuotedList(tokens, file);
    case 'SYMBOL':
      return new Symbol(tokens, file);
    default:
      throw new errors.SyntaxError(file, peek.line, peek.column);
    }
  }

  exports.Expression = Expression;


  function Definition (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'def');

    consumeType(file, tokens, 'OPEN_PAREN');
    this.symbol = new Symbol(tokens, file);

    this.params = [];
    var lastToken = this.symbol;
    do {
      if ( tokens.length === 0 ) {
        throw new errors.SyntaxError(file, lastToken.line, lastToken.column);
      } else if ( tokens[0].type === 'CLOSE_PAREN' ) {
        consumeType(file, tokens, 'CLOSE_PAREN');
        break;
      } else {
        this.params.push(new Symbol(tokens, file));
      }
    } while ( true );

    this.body = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  Definition.prototype.compile =
    function Definition_compile (inExpression, indent, indentStep, sourceMap) {
      return indentTo(indent) + 'function '
        + this.symbol.compile(true, indent, indentStep, sourceMap).trim()
        + '(' + compileParameterList(this.params, indent, indentStep, sourceMap) + ') {\n'
        + compileBody(this.body, true, indent + indentStep, indentStep, sourceMap)
        + indentTo(indent) + '}';
    };


  function Assignment (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'set!');
    // TODO: allow any LHS?
    this.symbol = new Symbol(tokens, file);
    this.expression = new Expression(tokens, file);
    consumeType(file, tokens, 'CLOSE_PAREN');
  }

  Assignment.prototype.compile =
    function Assignment_compile (inExpression, indent, indentStep, sourceMap) {
      return indentTo(indent)
        + this.symbol.compile(true, indent, indentStep, sourceMap).trim()
        + ' = '
        + this.expression.compile(true, indent, indentStep, sourceMap).trim()
        + (inExpression ? '' : ';');
    };


  function Let (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'let');
    var lastToken = consumeType(file, tokens, 'OPEN_PAREN');

    this.bindings = consumeBindings(tokens, file, lastToken.line, lastToken.column);
    this.body = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  Let.prototype.compile =
    function Let_compile (inExpression, indent, indentStep, sourceMap) {
      // TODO: Right now, to make sure that the variables are unbound after the
      // let expression, every let is wrapped in an immediately invoked function
      // expression. This function wrapping is inefficient and should only
      // really happen when inExpression is true, if we could reliably use
      // gensyms. However, this would require knowing some things about the
      // lexical environment at compile time, which is possible but not
      // implemented.
      var variables = [];
      var values = [];
      this.bindings.forEach(function (b) {
        variables.push(b.symbol.compile(true, indent + indentStep, indentStep, sourceMap).trim());
        values.push(b.value.compile(true, indent + indentStep, indentStep, sourceMap).trim());
      });
      return indentTo(indent) + '(function (' + variables.join(', ') + ') {\n'
        + compileBody(this.body, inExpression, indent + indentStep, indentStep, sourceMap)
        + indentTo(indent) + '}(' + values.join(', ') + '))';
    };


  function Conditional (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    var lastToken = consumeSymbol(file, tokens, 'if');
    this.predicate = new Expression(tokens, file);
    this.consequent = new Expression(tokens, file);
    if ( tokens.length === 0 ) {
      throw new errors.SyntaxError(file, lastToken.line, lastToken.column);
    } else if ( tokens[0].type === 'CLOSE_PAREN' ) {
      this.alternative = null;
      consumeType(file, tokens, 'CLOSE_PAREN');
    } else {
      this.alternative = new Expression(tokens, file);
      consumeType(file, tokens, 'CLOSE_PAREN');
    }
  }

  Conditional.prototype.compile =
    function Conditional_compile (inExpression, indent, indentStep, sourceMap) {
      var predicate = this.predicate
        .compile(true, indent + indentStep, indentStep, sourceMap)
        .trim();
      var consequent = this.consequent.compile(inExpression, indent + indentStep, indentStep, sourceMap);
      var alternative = this.alternative
        ? this.alternative.compile(inExpression, indent + indentStep, indentStep, sourceMap)
        : null;

      if ( inExpression ) {
        return indentTo(indent) + '('
          + predicate
          + ' ? ' + consequent.trim()
          + ' : ' + (alternative + '').trim()
          + ')';
      } else {
        return indentTo(indent) + 'if (' + predicate + ') {\n'
          + consequent.replace(/;$/, '')
          + ';\n' + indentTo(indent)  + '}'
          + (alternative
             ? ' else {\n' + alternative.replace(/;$/, '') + ';\n' + indentTo(indent) + '}'
             : '')
      }
    };


  function Throw (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'throw');
    this.value = new Expression(tokens, file);
    consumeType(file, tokens, 'CLOSE_PAREN');
  }

  Throw.prototype.compile =
    function Throw_compile (inExpression, indent, indentStep, sourceMap) {
      if ( inExpression ) {
        return indentTo(indent) + '(function () { throw '
          + this.value.compile(true, indent + indentStep, indentStep, sourceMap).trim()
          + '; }())';
      } else {
        return indentTo(indent) + 'throw '
          + this.value.compile(false, indent + indentStep, indentStep, sourceMap).trim()
          + ';';
      }
    };


  function Instantiation (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    var lastToken = consumeSymbol(file, tokens, 'new');
    this.ctor = new Expression(tokens, file);
    this.params = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  Instantiation.prototype.compile =
    function Instantiation_compile (inExpression, indent, indentStep, sourceMap) {
      var ctor = this.ctor
        .compile(true, indent + indentStep, indentStep, sourceMap)
        .trim();
      return indentTo(indent) + 'new '
        + (this.ctor instanceof Symbol ? ctor : '(' + ctor + ')')
        + '('
        + compileParameterList(this.params, indent + indentStep, indentStep, sourceMap)
        + ')';
    };


  function Try (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'try');
    this.expression = new Expression(tokens, file);
    consumeType(file, tokens, 'OPEN_PAREN');
    var lastToken = consumeSymbol(file, tokens, 'catch');
    consumeType(file, tokens, 'OPEN_PAREN');
    this.symbol = new Symbol(tokens, file);
    consumeType(file, tokens, 'CLOSE_PAREN');
    this.body = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
    consumeType(file, tokens, 'CLOSE_PAREN');
  }

  Try.prototype.compile =
    function Try_compile (inExpression, indent, indentStep, sourceMap) {
      if ( inExpression ) {
        return indentTo(indent) + '(function () {\n'
          + indentTo(indent + indentStep) + 'try {\n'
          + this.expression.compile(true, indent + indentStep * 2, indentStep, sourceMap)
          + ';\n' + indentTo(indent + indentStep) + '} catch ('
          + this.symbol.compile(true, indent, indentStep, sourceMap).trim() + ') {\n'
          + compileBody(this.body, indent + indentStep * 2, indentStep, sourceMap)
          + indentTo(indent + indentStep) + '}\n'
          + indentTo(indent) + '}())';
      } else {
        return indentTo(indent) + 'try {\n'
          + this.expression.compile(true, indent + indentStep, indentStep, sourceMap)
          + ';\n' + indentTo(indent) + '} catch ('
          + this.symbol.compile(true, indent, indentStep, sourceMap).trim() + ') {\n'
          + compileBody(this.body, false, indent + indentStep, indentStep, sourceMap)
          + indentTo(indent) + '}\n'
      }
    };


  function ListComprehension (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    consumeSymbol(file, tokens, 'for');
    var lastToken = consumeType(file, tokens, 'OPEN_PAREN');

    this.bindings = consumeBindings(tokens, file, lastToken.line, lastToken.column);
    this.body = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  ListComprehension.prototype.compile =
    function ListComprehension_compile (inExpression, indent, indentStep, sourceMap) {
      var prefix = [];
      var suffix = [];
      var i;

      var indices = [];
      var symbols = [];
      var arrays = [];
      var lengths = [];
      var results;

      if ( inExpression ) {
        prefix.push(indentTo(indent) + '(function () {');
        suffix.unshift(indentTo(indent) + '}())');
        indent += indentStep;
        results = gensym('results');
        prefix.push(indentTo(indent) + 'var ' + results + ' = [];');
        suffix.unshift(indentTo(indent) + 'return ' + results + ';');
      }

      prefix.push();

      for ( i = 0; i < this.bindings.length; i++ ) {
        symbols.push(this.bindings[i].symbol.compile(true, indent, indentStep, sourceMap).trim());
        prefix.push(indentTo(indent) + 'var ' + symbols[i] + ';');

        arrays.push(gensym('array'));
        prefix.push(indentTo(indent) + 'var ' + arrays[i] + ' = '
                    + this.bindings[i].value
                    .compile(true, indent + indentStep, indentStep, sourceMap)
                    .trim()
                    + ';');

        indices.push(gensym(String.fromCharCode('i'.charCodeAt(0) + i)));
        lengths.push(gensym('len'));
      }

      for ( i = 0; i < this.bindings.length; i++ ) {
        prefix.push(indentTo(indent)
                    + 'for (var ' + indices[i] + ' = 0, ' + lengths[i] + ' = ' + arrays[i] + '.length; '
                    + indices[i] + ' < ' + lengths[i] + '; ' + indices[i] + '++) {');
        prefix.push(indentTo(indent + indentStep) + symbols[i] + ' = '
                    + arrays[i] + '[' + indices[i] + '];');
        suffix.unshift(indentTo(indent) + '}');
        indent += indentStep;
      }

      if ( inExpression ) {
        prefix.push(compileBody(this.body, true, indent, indentStep,
                                sourceMap, results + '.push(', ');').replace(/\s+$/, ''));
      } else {
        prefix.push(compileBody(this.body, false, indent, indentStep, sourceMap).replace(/\s+$/, ''));
      }

      return prefix.concat(suffix).join('\n');
    };

  function While (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    var lastToken = consumeSymbol(file, tokens, 'while');
    this.predicate = new Expression(tokens, file);
    this.body = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  While.prototype.compile =
    function While_compile (inExpression, indent, indentStep, sourceMap) {
      var results;
      if ( inExpression ) {
        results = gensym('results');
        return indentTo(indent) + '(function () {\n'
          + indentTo(indent + indentStep) + 'var ' + results + ' = [];\n'
          + indentTo(indent + indentStep) + 'while ('
          + this.predicate.compile(true, indent + indentStep * 2, indentStep, sourceMap).trim()
          + ') {\n'
          + compileBody(this.body, true, indent + indentStep * 2, indentStep, sourceMap,
                        results + '.push(', ')')
          + indentTo(indent + indentStep) + '}\n'
          + indentTo(indent + indentStep) + 'return ' + results + ';\n'
          + indentTo(indent) + '}())';
      } else {
        return indentTo(indent) + 'while ('
          + this.predicate.compile(true, indent + indentStep, indentStep, sourceMap).trim()
          + ') {\n'
          + compileBody(this.body, false, indent + indentStep, indentStep, sourceMap)
          + indentTo(indent) + '}';
      }
    };


  function Application (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    this.symbol = new Symbol(tokens, file);
    this.params = consumeExpressions(tokens, file, this.symbol.line, this.symbol.column);
  }

  Application.prototype.compile =
    function Application_compile (inExpression, indent, indentStep, sourceMap) {
      var symbol = this.symbol.value;
      switch ( symbol ) {
      case '+':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else if ( this.params.length === 1 ) {
          return this._compileUnaryOperator('+', indent, indentStep, sourceMap);
        } else {
          return this._compileBinaryOperator('+', indent, indentStep, sourceMap);
        }
      case '-':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else if ( this.params.length === 1 ) {
          return this._compileUnaryOperator('-', indent, indentStep, sourceMap);
        } else {
          return this._compileBinaryOperator('-', indent, indentStep, sourceMap);
        }
      case 'or':
        if ( this.params.length === 0 ) {
          return indentTo(indent) + 'false';
        } else if (this.params.length === 1) {
          return this.params[0].compile(true, indent, indentStep, sourceMap);
        } else {
          return this._compileBinaryOperator('&&', indent, indentStep, sourceMap);
        }
      case 'and':
        if ( this.params.length === 0 ) {
          return indentTo(indent) + 'true';
        } else if (this.params.length === 1) {
          return this.params[0].compile(true, indent, indentStep, sourceMap);
        } else {
          return this._compileBinaryOperator('&&', indent, indentStep, sourceMap);
        }
      case 'not':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileUnaryOperator('!', indent, indentStep, sourceMap);
        }
      case 'delete!':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileUnaryOperator('delete', indent, indentStep, sourceMap);
        }
      case 'bit-or':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('|', indent,
                                             indentStep, sourceMap);
        }
      case 'bit-and':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('&', indent,
                                             indentStep, sourceMap);
        }
      case 'bit-xor':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('^', indent,
                                             indentStep, sourceMap);
        }
      case 'in?':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('in', indent,
                                             indentStep, sourceMap);
        }
      case 'instanceof?':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('instanceof', indent,
                                             indentStep, sourceMap);
        }
      case 'eq?':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator('===', indent,
                                             indentStep, sourceMap);
        }
      case 'typeof?':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileUnaryOperator('typeof ', indent,
                                                    indentStep, sourceMap);
        }
      case '<':
      case '<=':
      case '>':
      case '>=':
      case '/':
      case '*':
      case '%':
      case '<<':
      case '>>':
      case '>>>':
        if ( this.params.length === 0 ) {
          throw new errors.SyntaxError(null, this.symbol.line, this.symbol.column);
        } else {
          return this._compileBinaryOperator(symbol, indent, indentStep, sourceMap);
        }
      default:
        return indentTo(indent) + this.symbol.compile(true, indent, indentStep, sourceMap)
          + '(' + compileParameterList(this.params, indent, indentStep, sourceMap) + ')'
          + (inExpression ? '' : ';');
      }
    };

  Application.prototype._compileUnaryOperator =
    function Application_compileUnaryOperator (operator, indent, indentStep, sourceMap) {
      return indentTo(indent) + '(' + operator
        + this.params[0].compile(true, indent + indentStep, indentStep, sourceMap).trim()
        + ')';
    };

  Application.prototype._compileBinaryOperator =
    function Application_compileBinaryOperator (operator, indent, indentStep, sourceMap) {
      return '(' + this.params.map(function (p) {
        return p.compile(true, indent + indentStep, indentStep, sourceMap).trim();
      }).join(' ' + operator + ' ') + ')';
    };


  function PropertyAccess (tokens, file) {
    file = file || '(unknown file)';
    consumeType(file, tokens, 'OPEN_PAREN');
    var lastToken = consumeSymbol(file, tokens, '@');
    this.object = new Expression(tokens, file);
    this.properties = consumeExpressions(tokens, file, lastToken.line, lastToken.column);
  }

  PropertyAccess.prototype.compile =
    function PropertyAccess_compile (inExpression, indent, indentStep, sourceMap) {
    };


  function Object_ (tokens, file) {
    file = file || '(unknown file)';
    var lastToken = consumeType(file, tokens, 'OPEN_BRACE');

    this.properties = [];
    do {
      if ( tokens.length === 0 ) {
        throw new errors.SyntaxError(file, lastToken.line, lastToken.column);
      } else if ( tokens[0].type === 'CLOSE_BRACE' ) {
        consumeType(file, tokens, 'CLOSE_BRACE');
        break;
      } else {
        this.properties.push({
          symbol: consumeType(file, tokens, 'symbol'),
          value: new Expression(tokens, file)
        });
        lastToken = consumeType(file, tokens, 'CLOSE_PAREN');
      }
    } while ( true );
  }

  Object_.prototype.compile =
    function Object_compile (inExpression, indent, indentStep, sourceMap) {
    };


  function List (tokens, file) {
    file = file || '(unknown file)';
    var lastToken = consumeType(file, tokens, 'OPEN_BRACKET');

    this.elements = [];
    do {
      if ( tokens.length === 0 ) {
        throw new errors.SyntaxError(file, lastToken.line, lastToken.column);
      } else if ( tokens[0].type === 'CLOSE_BRACKET' ) {
        consumeType(file, tokens, 'CLOSE_BRACKET');
        break;
      } else {
        this.elements.push(new Expression(tokens, file));
      }
    } while ( true );
  }

  List.prototype.compile =
    function List_compile (inExpression, indent, indentStep, sourceMap) {
    };


  function Number_ (tokens, file) {
    file = file || '(unknown file)';
    this.value = consumeType(file, tokens, 'NUMBER').value;
  }

  Number_.prototype.compile =
    function Number_compile (inExpression, indent, indentStep, sourceMap) {
      return indentTo(indent) + this.value;
    };


  function String_ (tokens, file) {
    file = file || '(unknown file)';
    this.value = consumeType(file, tokens, 'NUMBER');
  }

  String_.prototype.compile =
    function String_compile (inExpression, indent, indentStep, sourceMap) {
    };


  function Symbol (tokens, file) {
    file = file || '(unknown file)';
    this.value = consumeType(file, tokens, 'SYMBOL').value;
  }

  Symbol.prototype.compile =
    function Symbol_compile (inExpression, indent, indentStep, sourceMap) {
      return indentTo(indent) + this.value.replace(/:/g, '.').replace(/[^\.\w]+/g, '_');
    };

});
