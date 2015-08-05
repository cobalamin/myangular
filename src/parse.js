/* jshint globalstrict: true */
'use strict';

// Lexer =======================================================================

var ESCAPES = {'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
               'v': '\v', '\'': '\'', '"': '"'};

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
        this.ch === '.' && this.isDigit(this.peek())) {
      this.readNumber();
    } else if (this.ch === "'" || this.ch === '"') {
      this.readString(this.ch);
    } else {
      throw new Error("Unexpected next character: " + this.ch);
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
  var escape = false;

  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
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
        text: string,
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

Lexer.prototype.peek = function() {
  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) :
    false;
};

// AST Builder =================================================================

function AST(lexer) {
  this.lexer = lexer;
}
AST.Program = 'Program';
AST.Literal = 'Literal';

AST.prototype.ast = function(text) {
  this.tokens = this.lexer.lex(text);
  return this.program();
};

AST.prototype.program = function() {
  return {type: AST.Program, body: this.constant()};
};

AST.prototype.constant = function() {
  return {type: AST.Literal, value: this.tokens[0].value};
};

// AST Compiler ================================================================

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
  var ast = this.astBuilder.ast(text);
  this.state = {body: []};
  this.recurse(ast);
  /* jshint -W054 */
  return new Function(this.state.body.join(''));
  /* jshint +W054 */
};

ASTCompiler.prototype.recurse = function(ast) {
  switch (ast.type) {
    case AST.Program:
      this.state.body.push('return ', this.recurse(ast.body), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
  }
};

ASTCompiler.prototype.escape = function(value) {
  if (_.isString(value)) {
    return "'" +
      value.replace(this.stringEscapeRegex, this.stringEscapeFn) +
      "'";
  } else {
    return value;
  }
};
ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
ASTCompiler.prototype.stringEscapeFn = function(c) {
  // use '0000' and slice(-4) for zero-padding
  return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
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

  return parser.parse(expr);
}
