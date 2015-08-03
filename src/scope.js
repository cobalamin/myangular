/* jshint globalstrict: true */
'use strict';

var initWatchVal = {};

function Scope() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;

  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;

  this.$$postDigestQueue = [];

  this.$$phase = null;
}

// === Watch ===
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var self = this;

  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function(){},
    valueEq: !!valueEq,
    last: initWatchVal
  };

  this.$$watchers.unshift(watcher);
  this.$$lastDirtyWatch = null;

  return function() {
    var index = self.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index, 1);
      self.$$lastDirtyWatch = null;
    }
  };
};

// === Digest ===
Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  if (this.$$applyAsyncId) {
    clearTimeout(this.$$applyAsyncId);
    this.$$flushApplyAsync();
  }

  do {
    while (this.$$asyncQueue.length) {
      try {
        var asyncTask = this.$$asyncQueue.shift();
        asyncTask.scope.$eval(asyncTask.expression);
      } catch (e) {
        console.error(e);
      }
    }

    dirty = this.$$digestOnce();
    if ((dirty || this.$$asyncQueue.length) && !ttl) {
      this.$clearPhase();
      throw new Error("10 digest iterations reached!");
    }
    ttl--;
  } while (dirty || this.$$asyncQueue.length);

  this.$clearPhase();

  while (this.$$postDigestQueue.length) {
    try {
      var f = this.$$postDigestQueue.shift();
      f();
    } catch (e) {
      console.error(e);
    }
  }
};

Scope.prototype.$$digestOnce = function() {
  var self = this;
  var newValue, oldValue, dirty = false;

  _.forEachRight(this.$$watchers, function(watcher) {
    if(watcher) {
      try {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;

        if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
          self.$$lastDirtyWatch = watcher;

          watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
          watcher.listenerFn(newValue,
            oldValue === initWatchVal ? newValue : oldValue,
            self);

            dirty = true;
        }
        else if (self.$$lastDirtyWatch === watcher) {
          return false;
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  return dirty;
};

Scope.prototype.$$postDigest = function (fn) {
  this.$$postDigestQueue.push(fn);
};

// === Apply ===
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};

Scope.prototype.$applyAsync = function (expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function () {
    self.$eval(expr);
  });
  if (self.$$applyAsyncId === null) {
    self.$$applyAsyncId = setTimeout(function () {
      self.$apply(_.bind(self.$$flushApplyAsync, self));
    }, 0);
  }
};

Scope.prototype.$$flushApplyAsync = function () {
  while (this.$$applyAsyncQueue.length) {
    try {
      var f = this.$$applyAsyncQueue.shift();
      f();
    } catch (e) {
      console.error(e);
    }
  }
  this.$$applyAsyncId = null;
};

// === Eval ===
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

Scope.prototype.$evalAsync = function(expr) {
  if(!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(_.bind(function () {
      if (this.$$asyncQueue.length) {
        this.$digest();
      }
    }, this), 0);
  }
  this.$$asyncQueue.push({ scope: this, expression: expr });
};

// === Equality ===
Scope.prototype.$$areEqual = function(newVal, oldVal, valueEq) {
  if (valueEq) {
    return _.isEqual(newVal, oldVal);
  }
  else {
    return newVal === oldVal ||
    (typeof newVal === 'number' && typeof oldVal === 'number' &&
    isNaN(newVal) && isNaN(oldVal));
  }
};

// === Phases ===
Scope.prototype.$beginPhase = function (phase) {
  if (this.$$phase) {
    throw new Error(this.$$phase + ' already in progress.');
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
  this.$$phase = null;
};
