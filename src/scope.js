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

  this.$root = this;
  this.$$children = [];

  this.$$phase = null;
}

// === Watch ===
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function(){},
    valueEq: !!valueEq,
    last: initWatchVal
  };

  this.$$watchers.unshift(watcher);
  this.$root.$$lastDirtyWatch = null;

  return _.bind(function() {
    var index = this.$$watchers.indexOf(watcher);
    if (index >= 0) {
      this.$$watchers.splice(index, 1);
      this.$root.$$lastDirtyWatch = null;
    }
  }, this);
};

Scope.prototype.$watchGroup = function (watchFns, listenerFn) {
  var self = this;
  var newValues = [], oldValues = [];
  var changeReactionScheduled = false;
  var firstRun = true;

  if (watchFns.length === 0) {
    var shouldCall = true;
    self.$evalAsync(function () {
      if (shouldCall) {
        listenerFn(newValues, newValues, self);
      }
    });
    return function() { shouldCall = false; };
  }

  function watchGroupListener() {
    if (firstRun) {
      firstRun = false;
      listenerFn(newValues, newValues, self);
    }
    else {
      listenerFn(newValues, oldValues, self);
    }
    changeReactionScheduled = false;
  }

  var destroyFns = _.map(watchFns, function (watchFn, i) {
    return self.$watch(watchFn, function(newValue, oldValue) {
      newValues[i] = newValue;
      oldValues[i] = oldValue;
      if (!changeReactionScheduled) {
        changeReactionScheduled = true;
        self.$evalAsync(watchGroupListener);
      }
    });
  });

  return function() {
    _.forEach(destroyFns, function (destroyFn) {
      destroyFn();
    });
  };
};

// === Digest ===
Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty;
  this.$root.$$lastDirtyWatch = null;
  this.$beginPhase('$digest');

  if (this.$root.$$applyAsyncId) {
    clearTimeout(this.$root.$$applyAsyncId);
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
  var continueLoop = true;
  var dirty = false;

  this.$$everyScope(function (scope) {
    var newValue, oldValue;

    _.forEachRight(scope.$$watchers, function (watcher) {
      if(watcher) {
        try {
          newValue = watcher.watchFn(scope);
          oldValue = watcher.last;

          if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            scope.$root.$$lastDirtyWatch = watcher;

            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue,
              (oldValue === initWatchVal ? newValue : oldValue),
              scope);

              dirty = true;
          }
          else if (scope.$root.$$lastDirtyWatch === watcher) {
            continueLoop = false;
            return false;
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    return continueLoop;
  });

  return dirty;
};

Scope.prototype.$$postDigest = function (fn) {
  this.$$postDigestQueue.push(fn);
};

Scope.prototype.$$everyScope = function (fn) {
  return fn(this) && _.every(this.$$children, function (child) {
    return child.$$everyScope(fn);
  });
};

// === Apply ===
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$root.$digest();
  }
};

Scope.prototype.$applyAsync = function (expr) {
  this.$$applyAsyncQueue.push(_.bind(function () {
    this.$eval(expr);
  }, this));
  if (this.$root.$$applyAsyncId === null) {
    this.$root.$$applyAsyncId = setTimeout(_.bind(function () {
      this.$apply(_.bind(this.$$flushApplyAsync, this));
    }, this), 0);
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
  this.$root.$$applyAsyncId = null;
};

// === Eval ===
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

Scope.prototype.$evalAsync = function(expr) {
  if(!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(_.bind(function () {
      if (this.$$asyncQueue.length) {
        this.$root.$digest();
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

// === Child Scopes ===
Scope.prototype.$new = function (isolated, parent) {
  var child;
  parent = parent || this;

  if (isolated) {
    child = new Scope();
    child.$root = parent.$root;
    child.$$asyncQueue = parent.$$asyncQueue;
    child.$$postDigestQueue = parent.$$postDigestQueue;
    child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
  }
  else {
    child = Object.create(this);
    // Shadowing these properties
    child.$$watchers = [];
    child.$$children = [];
  }

  parent.$$children.push(child);
  return child;
};
