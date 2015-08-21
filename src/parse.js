/* jshint globalstrict: true */
'use strict';

// Helpers =====================================================================

function ensureSafeMemberName(name) {
  var forbidden = ['constructor', '__proto__', '__defineGetter__',
                   '__defineSetter__', '__lookupGetter__', '__lookupSetter__'];
  if (~forbidden.indexOf(name)) {
    throw new Error("Attempting to access a disallowed field in an Angular expression!");
  }
}

function ensureSafeObject(obj) {
  if (obj) {
    if (obj.document && obj.location && obj.alert && obj.setInterval) {
      throw new Error("Referencing window in Angular expressions is disallowed!");
    } else if (obj.children && (obj.nodeName || (obj.prop && obj.attr && obj.find))) {
      throw new Error("Referencing DOM nodes in Angular expressions is disallowed!");
    } else if (obj.constructor === obj) {
      throw new Error("Referencing Function in Angular expressions is disallowed!");
    } else if (obj.getOwnPropertyNames || obj.getOwnPropertyDescriptor) {
      throw new Error("Referencing Object in Angular expressions is disallowed!");
    }
  }
  return obj;
}

function ensureSafeFunction(obj) {
  if (obj) {
    if (obj.constructor === obj) {
      throw new Error("Referencing Function in Angular expressions is disallowed!");
    } else if (obj === Function.prototype.call ||
      obj === Function.prototype.apply ||
      obj === Function.prototype.bind) {
      throw new Error("Referencing call, apply, or bind in Angular expressions is disallowed!");
    }
  }
  return obj;
}

function ifDefined(value, defaultValue) {
  return typeof value === 'undefined' ? defaultValue : value;
}

// Lexer =======================================================================

var ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
               'v': '\v', '\'': '\'', '"': '"'};
var OPERATORS = {
  '+': true,
  '!': true,
  '-': true,
  '*': true,
  '/': true,
  '%': true,
  '=': true,
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
  '&&': true,
  '||': true
};

function Lexer() {
}

Lexer.prototype.lex = function(text) {
  this.text = text;
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];

  while (this.index < this.text.length) {
    this.ch = this.text.charAt(this.index);

    if (this.isDigit(this.ch) ||
        (this.isOneOf('.') && this.isDigit(this.peek()))) {
      this.readNumber();
    } else if (this.isOneOf('\'"')) {
      this.readString(this.ch);
    } else if (this.isOneOf('[],{}:.()?')) {
      this.tokens.push({
        text: this.ch
      });
      this.index++;
    } else if (this.isIdent(this.ch)) {
      this.readIdent();
    } else if (this.isWhitespace(this.ch)) {
      this.index++;
    } else {
      var ch = this.ch;
      var ch2 = this.ch + this.peek();
      var ch3 = this.ch + this.peek() + this.peek(2);
      var op = OPERATORS[ch];
      var op2 = OPERATORS[ch2];
      var op3 = OPERATORS[ch3];

      if (op || op2 || op3) {
        var token = op3 ? ch3 : (op2 ? ch2 : ch);
        this.tokens.push({ text: token });
        this.index += token.length;
      } else {
        throw new Error("Unexpected next character: " + this.ch);
      }
    }
  }

  return this.tokens;
};

Lexer.prototype.isDigit = function(ch) {
  return '0' <= ch && ch <= '9';
};
Lexer.prototype.isExpOperator = function(ch) {
  return ch === '-' || ch === '+' || this.isDigit(ch);
};
Lexer.prototype.isIdent = function(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
    ch === '_' || ch === '$';
};
Lexer.prototype.isWhitespace = function(ch) {
  return ch === ' ' || ch === '\r' || ch === '\t' ||
         ch === '\n' || ch === '\v' || ch === '\u00a0';
};
Lexer.prototype.isOneOf = function(chs) {
  return chs.indexOf(this.ch) >= 0;
};

Lexer.prototype.readNumber = function() {
  var number = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index).toLowerCase();
    if (ch === '.' || this.isDigit(ch)) {
      number += ch;
    } else {
      var next = this.peek();
      var prev = number.charAt(number.length - 1);
      if (ch === 'e' && this.isExpOperator(next)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prev === 'e' &&
                  next && this.isDigit(next)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prev === 'e' &&
                  (!next || !this.isDigit(next))) {
        throw new Error("Invalid exponent");
      } else {
        break;
      }
    }
    this.index++;
  }

  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

Lexer.prototype.readString = function(delim) {
  this.index++;
  var string = '';
  var rawString = delim;
  var escape = false;

  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    rawString += ch;
    if (escape) {
      if (ch === 'u') {
        var hex = this.text.substring(this.index + 1, this.index + 5);
        if (!hex.match(/[\da-f]{4}/i)) {
          throw new Error("Invalid unicode escape");
        }
        this.index += 4;
        string += String.fromCharCode(parseInt(hex, 16));
      } else {
        var replacement = ESCAPES[ch];
        if (replacement) {
          string += replacement;
        } else {
          string += ch;
        }
      }

      escape = false;
    } else if (ch === delim) {
      this.index++;
      this.tokens.push({
        text: rawString,
        value: string
      });
      return;
    } else if (ch === '\\') {
      escape = true;
    } else {
      string += ch;
    }
    this.index++;
  }
};

Lexer.prototype.readIdent = function() {
  var text = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (this.isIdent(ch) || this.isDigit(ch)) {
      text += ch;
    } else {
      break;
    }
    this.index++;
  }

  var token = {
    text: text,
    identifier: true
  };
  this.tokens.push(token);
};

Lexer.prototype.peek = function(n) {
  n = n || 1;
  return this.index + n < this.text.length ?
    this.text.charAt(this.index + n) :
    false;
};

// AST Builder =================================================================

function AST(lexer) {
  this.lexer = lexer;
}
AST.Program = 'Program';
AST.Literal = 'Literal';
AST.ArrayExpression = 'ArrayExpression';
AST.ObjectExpression = 'ObjectExpression';
AST.Property = 'Property';
AST.Identifier = 'Identifier';
AST.ThisExpression = 'ThisExpression';
AST.MemberExpression = 'MemberExpression';
AST.CallExpression = 'CallExpression';
AST.AssignmentExpression = 'AssignmentExpression';
AST.UnaryExpression = 'UnaryExpression';
AST.BinaryExpression = 'BinaryExpression';
AST.LogicalExpression = 'LogicalExpression';
AST.ConditionalExpression = 'ConditionalExpression';

AST.prototype.constants = {
  'null': {type: AST.Literal, value: null},
  'true': {type: AST.Literal, value: true},
  'false': {type: AST.Literal, value: false},
  'this': {type: AST.ThisExpression}
};

AST.prototype.ast = function(text) {
  this.tokens = this.lexer.lex(text);
  return this.program();
};

AST.prototype.program = function() {
  return {type: AST.Program, body: this.assignment()};
};

AST.prototype.primary = function() {
  var primary;
  if (this.expect('(')) {
    primary = this.assignment();
    this.consume(')');
  } else if (this.expect('[')) {
    primary = this.arrayDeclaration();
  } else if (this.expect('{')) {
    primary = this.objectDeclaration();
  } else if (this.constants.hasOwnProperty(this.tokens[0].text)) {
    primary = this.constants[this.consume().text];
  } else if (this.peek().identifier) {
    primary = this.identifier();
  } else {
    primary = this.constant();
  }
  var next;

  while ((next = this.expect('.', '[', '('))) {
    if (next.text === '[') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.primary(),
        computed: true
      };
      this.consume(']');
    } else if (next.text === '.') {
      primary = {
        type: AST.MemberExpression,
        object: primary,
        property: this.identifier(),
        computed: false
      };
    } else if (next.text === '(') {
      primary = {
        type: AST.CallExpression,
        callee: primary,
        args: this.parseArguments()
      };
      this.consume(')');
    }
  }
  return primary;
};

AST.prototype.unary = function() {
  var token;
  if ((token = this.expect('+', '!', '-'))) {
    return {
      type: AST.UnaryExpression,
      operator: token.text,
      argument: this.unary()
    };
  } else {
    return this.primary();
  }
};

AST.prototype.multiplicative = function() {
  var left = this.unary();
  var token;
  while ((token = this.expect('*', '/', '%'))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.unary()
    };
  }
  return left;
};

AST.prototype.additive = function() {
  var left = this.multiplicative();
  var token;
  while ((token = this.expect('+')) || (token = this.expect('-'))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.multiplicative()
    };
  }
  return left;
};

AST.prototype.equality = function() {
  var left = this.relational();
  var token;
  while ((token = this.expect('==', '!=', '===', '!=='))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.relational()
    };
  }
  return left;
};

AST.prototype.relational = function() {
  var left = this.additive();
  var token;
  while ((token = this.expect('<', '>', '<=', '>='))) {
    left = {
      type: AST.BinaryExpression,
      left: left,
      operator: token.text,
      right: this.additive()
    };
  }
  return left;
};

AST.prototype.logicalOR = function() {
  var left = this.logicalAND();
  var token;
  while ((token = this.expect('||'))) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.logicalAND()
    };
  }
  return left;
};

AST.prototype.logicalAND = function() {
  var left = this.equality();
  var token;
  while ((token = this.expect('&&'))) {
    left = {
      type: AST.LogicalExpression,
      left: left,
      operator: token.text,
      right: this.equality()
    };
  }
  return left;
};

AST.prototype.ternary = function() {
  var test = this.logicalOR();
  if (this.expect('?')) {
    var consequent = this.assignment();
    if (this.consume(':')) {
      var alternate = this.assignment();
      return {
        type: AST.ConditionalExpression,
        test: test,
        consequent: consequent,
        alternate: alternate
      };
    }
  }
  return test;
};

AST.prototype.assignment = function() {
  var left = this.ternary();
  if (this.expect('=')) {
    var right = this.ternary();
    return {type: AST.AssignmentExpression, left: left, right: right};
  }
  return left;
};

AST.prototype.constant = function() {
  return {type: AST.Literal, value: this.consume().value};
};

AST.prototype.identifier = function() {
  return {type: AST.Identifier, name: this.consume().text};
};

AST.prototype.arrayDeclaration = function() {
  var elements = [];
  if (!this.peek(']')) {
    do {
      if (this.peek(']')) {
        break;
      }
      elements.push(this.assignment());
    } while (this.expect(','));
  }

  this.consume(']');
  return {type: AST.ArrayExpression, elements: elements};
};

AST.prototype.objectDeclaration = function() {
  var properties = [];

  if (!this.peek('}')) {
    do {
      var property = {type: AST.Property};
      if (this.peek().identifier) {
        property.key = this.identifier();
      } else {
        property.key = this.constant();
      }

      this.consume(':');
      property.value = this.assignment();
      properties.push(property);
    } while (this.expect(','));
  }

  this.consume('}');
  return {type: AST.ObjectExpression, properties: properties};
};

AST.prototype.parseArguments = function() {
  var args = [];
  if (!this.peek(')')) {
    do {
      args.push(this.assignment());
    } while (this.expect(','));
  }
  return args;
};

AST.prototype.expect = function() {
  var token = this.peek.apply(this, arguments);
  if (token) {
    return this.tokens.shift();
  }
};

AST.prototype.consume = function(e) {
  var token = this.expect(e);
  if (!token) {
    throw new Error("Unexpected token. Expecting: " + e);
  }
  return token;
};

AST.prototype.peek = function() {
  if (this.tokens.length > 0) {
    var text = this.tokens[0].text;
    var anyMatches = _.some(arguments, function(e) { return text === e; });
    var allNone = _.every(arguments, function(e) { return !e; });
    if (anyMatches || allNone) {
      return this.tokens[0];
    }
  }
};

// AST Compiler ================================================================

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
  var ast = this.astBuilder.ast(text);
  this.state = {body: [], nextId: 0, vars: []};
  this.recurse(ast);
  /* jshint -W054 */
  var fnString = 'var fn=function(s,l){' +
    (this.state.vars.length ?
      'var ' + this.state.vars.join(',') + ';' :
      ''
    ) + this.state.body.join('') +
    '}; return fn;';

  return new Function(
    'ensureSafeMemberName',
    'ensureSafeObject',
    'ensureSafeFunction',
    'ifDefined',
    fnString
    )(
      ensureSafeMemberName,
      ensureSafeObject,
      ensureSafeFunction,
      ifDefined
    );
  /* jshint +W054 */
};

ASTCompiler.prototype.recurse = function(ast, ctx, create) {
  var intoId;
  switch (ast.type) {
    case AST.Program:
      this.state.body.push('return ', this.recurse(ast.body), ';');
      break;

    case AST.Literal:
      return this.escape(ast.value);

    case AST.ArrayExpression:
      var elements = _.map(ast.elements, function(element) {
        return this.recurse(element);
      }, this);
      return '[' + elements.join(',') + ']';

    case AST.ObjectExpression:
      var properties = _.map(ast.properties, function(property) {
        var key = property.key.type === AST.Identifier ?
          property.key.name :
          this.escape(property.key.value);
        var value = this.recurse(property.value);
        return key + ':' + value;
      }, this);
      return '{' + properties.join(',') + '}';

    case AST.Identifier:
      ensureSafeMemberName(ast.name);
      intoId = this.nextId();
      var localsHasProperty = this.getHasProperty('l', ast.name);
      var scopeHasProperty = this.getHasProperty('s', ast.name);
      this.if_(localsHasProperty,
               this.assign(intoId, this.nonComputedMember('l', ast.name)));

      if (create) {
        var propInexistent = this.not(localsHasProperty) +
              ' && s && ' +
              this.not(scopeHasProperty);
        this.if_(propInexistent,
                 this.assign(this.nonComputedMember('s', ast.name), '{}'));
      }

      this.if_(this.not(localsHasProperty) + ' && s ',
               this.assign(intoId, this.nonComputedMember('s', ast.name)));
      if (ctx) {
        ctx.context = localsHasProperty + ' ?l:s';
        ctx.name = ast.name;
        ctx.computed = false;
      }
      this.addEnsureSafeObject(intoId);
      return intoId;

    case AST.ThisExpression:
      return 's';

    case AST.MemberExpression:
      intoId = this.nextId();
      var left = this.recurse(ast.object, undefined, create);
      if (ctx) {
        ctx.context = left;
      }
      if (ast.computed) {
        var right = this.recurse(ast.property);
        this.addEnsureSafeMemberName(right);
        if (create) {
          this.if_(this.not(this.computedMember(left, right)),
                   this.assign(this.computedMember(left, right), '{}'));
        }
        this.if_(left,
                 this.assign(intoId,
                   'ensureSafeObject(' + this.computedMember(left, right) + ')'));
        if (ctx) {
          ctx.name = right;
          ctx.computed = true;
        }
      } else {
        ensureSafeMemberName(ast.property.name);
        if (create) {
          this.if_(this.not(this.nonComputedMember(left, ast.property.name)),
                   this.assign(this.nonComputedMember(left, ast.property.name), '{}'));
        }
        this.if_(left,
                 this.assign(intoId,
                   'ensureSafeObject(' +
                   this.nonComputedMember(left, ast.property.name) + ')'));
        if (ctx) {
          ctx.name = ast.property.name;
          ctx.computed = false;
        }
      }
      return intoId;

    case AST.CallExpression:
      var callContext = {};
      var callee = this.recurse(ast.callee, callContext);
      var args = _.map(ast.args, function(a) {
        return 'ensureSafeObject(' + this.recurse(a) + ')';
      }, this);

      if (callContext.name) {
        this.addEnsureSafeObject(callContext.context);
        if (callContext.computed) {
          callee = this.computedMember(callContext.context, callContext.name);
        } else {
          callee = this.nonComputedMember(callContext.context, callContext.name);
        }
      }
      this.addEnsureSafeFunction(callee);
      return callee + ' && ensureSafeObject(' + callee + '(' + args.join(',') + '))';

    case AST.AssignmentExpression:
      var leftContext = {};
      this.recurse(ast.left, leftContext, true);

      var leftExpr;
      if (leftContext.computed) {
        leftExpr = this.computedMember(leftContext.context, leftContext.name);
      } else {
        leftExpr = this.nonComputedMember(leftContext.context, leftContext.name);
      }

      return this.assign(leftExpr,
        'ensureSafeObject(' + this.recurse(ast.right) + ')');

    case AST.UnaryExpression:
      return ast.operator +
        '(' + this.ifDefined(this.recurse(ast.argument), 0) + ')';

    case AST.BinaryExpression:
      if (ast.operator === '+' || ast.operator === '-') {
        return '(' + this.ifDefined(this.recurse(ast.left), 0) + ')' +
          ast.operator +
          '(' + this.ifDefined(this.recurse(ast.right), 0) + ')';
      } else {
        return '(' + this.recurse(ast.left) + ')' +
          ast.operator +
          '(' + this.recurse(ast.right) + ')';
      }
      break;

    case AST.LogicalExpression:
      intoId = this.nextId();
      this.state.body.push(this.assign(intoId, this.recurse(ast.left)));
      this.if_(ast.operator == '&&' ? intoId : this.not(intoId),
        this.assign(intoId, this.recurse(ast.right)));
      return intoId;

    case AST.ConditionalExpression:
      intoId = this.nextId();
      var testId = this.nextId();
      this.state.body.push(this.assign(testId, this.recurse(ast.test)));
      this.if_(testId,
        this.assign(intoId, this.recurse(ast.consequent)));
      this.if_(this.not(testId),
        this.assign(intoId, this.recurse(ast.alternate)));
      return intoId;

    default:
      throw new Error("Unknown AST node type!");
  }
};

ASTCompiler.prototype.escape = function(value) {
  if (_.isString(value)) {
    return "'" +
      value.replace(this.stringEscapeRegex, this.stringEscapeFn) +
      "'";
  } else if (_.isNull(value)) {
    return 'null';
  } else {
    return value;
  }
};
ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
ASTCompiler.prototype.stringEscapeFn = function(c) {
  // use '0000' and slice(-4) for zero-padding
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};

ASTCompiler.prototype.nonComputedMember = function(left, right) {
  return '(' + left + ').' + right;
};
ASTCompiler.prototype.computedMember = function(left, right) {
  return '(' + left + ')[' + right + ']';
};

ASTCompiler.prototype.if_ = function(test, consequent) {
  this.state.body.push('if(', test, '){', consequent, '}');
};
ASTCompiler.prototype.assign = function(id, value) {
  return id + '=' + value + ';';
};
ASTCompiler.prototype.not = function(e) {
  return '!(' + e + ')';
};
ASTCompiler.prototype.ifDefined = function(value, defaultValue) {
  return 'ifDefined(' + value + ',' + this.escape(defaultValue) + ')';
};

ASTCompiler.prototype.getHasProperty = function(o, prop) {
  return o + ' && (' + this.escape(prop) + ' in ' + o + ')';
};

ASTCompiler.prototype.nextId = function() {
  var id = '__v' + (this.state.nextId++);
  this.state.vars.push(id);
  return id;
};

ASTCompiler.prototype.addEnsureSafeMemberName = function(expr) {
  this.state.body.push('ensureSafeMemberName(' + expr + ');');
};
ASTCompiler.prototype.addEnsureSafeObject = function(expr) {
  this.state.body.push('ensureSafeObject(' + expr + ');');
};
ASTCompiler.prototype.addEnsureSafeFunction = function(expr) {
  this.state.body.push('ensureSafeFunction(' + expr + ');');
};

// Parser ======================================================================

function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function(text) {
  return this.astCompiler.compile(text);
};

function parse(expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer);

  var fn = parser.parse(expr);
  // console.log(fn.toString());
  return fn;
}
