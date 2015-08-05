/* jshint globalstrict: true */
'use strict';

// Lexer =======================================================================

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
    } else {
      throw new Error("Unexpected next character: " + this.ch);
    }
  }

  return this.tokens;
};

Lexer.prototype.isDigit = function(ch) {
  return '0' <= ch && ch <= '9';
};

Lexer.prototype.readNumber = function() {
  var number = '';
  while (this.index < this.text.length) {
    var ch = this.text.charAt(this.index);
    if (ch === '.' || this.isDigit(ch)) {
      number += ch;
    } else {
      break;
    }
    this.index++;
  }

  this.tokens.push({
    text: number,
    value: Number(number)
  });
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
      return ast.value;
  }
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

  var result = parser.parse(expr);
  console.log(result.toString());
  return result;
}
