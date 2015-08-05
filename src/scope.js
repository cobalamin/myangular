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

  this.$$listeners = {};

  this.$$phase = null;
}

// Watch =======================================================================

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

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
  var self = this;
  var newValues = [], oldValues = [];
  var changeReactionScheduled = false;
  var firstRun = true;

  if (watchFns.length === 0) {
    var shouldCall = true;
    self.$evalAsync(function() {
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

  var destroyFns = _.map(watchFns, function(watchFn, i) {
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
    _.forEach(destroyFns, function(destroyFn) {
      destroyFn();
    });
  };
};

// Watch Collection ============================================================

Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
  var newVal, oldVal;
  var changeCount = 0;
  var oldLength;
  var veryOldVal, trackVeryOldVal = (listenerFn.length > 1);
  var firstRun = true;

  var internalWatchFn = _.bind(function(scope) {
    var newLength;
    newVal = watchFn(scope);

    if (_.isObject(newVal)) {
      if (_.isArrayLike(newVal)) {
        // Arrays!
        if (!_.isArray(oldVal)) {
          changeCount++;
          oldVal = [];
        }
        if (newVal.length !== oldVal.length) {
          changeCount++;
          oldVal.length = newVal.length;
        }

        _.forEach(newVal, function(newItem, i) {
          var bothNaN = _.isNaN(newItem) && _.isNaN(oldVal[i]);
          if (!bothNaN && newItem !== oldVal[i]) {
            changeCount++;
            oldVal[i] = newItem;
          }
        });
      } else {
        // Objects!
        if (!_.isObject(oldVal) || _.isArrayLike(oldVal)) {
          changeCount++;
          oldVal = {};
          oldLength = 0;
        }
        newLength = 0;

        _.forOwn(newVal, function(newItem, key) {
          newLength++;
          if (oldVal.hasOwnProperty(key)) {
            var bothNaN = _.isNaN(newItem) && _.isNaN(oldVal[key]);
            if (!bothNaN && newItem !== oldVal[key]) {
              changeCount++;
              oldVal[key] = newItem;
            }
          } else {
            changeCount++;
            oldLength++;
            oldVal[key] = newItem;
          }
        });
        if (oldLength > newLength) {
          changeCount++;
          _.forOwn(oldVal, function(oldItem, key) {
            if (!newVal.hasOwnProperty(key)) {
              oldLength--;
              changeCount++;
              delete oldVal[key];
            }
          });
        }
      }
    } else {
      // Everything else (that's not actually a collection)!
      if (!this.$$areEqual(newVal, oldVal, false)) {
        changeCount++;
      }
      oldVal = newVal;
    }

    return changeCount;
  }, this);

  var internalListenerFn = _.bind(function() {
    if (firstRun) {
      listenerFn(newVal, newVal, this);
      firstRun = false;
    } else {
      listenerFn(newVal, veryOldVal, this);
    }

    if(trackVeryOldVal) {
      veryOldVal = _.clone(newVal);
    }
  }, this);

  return this.$watch(internalWatchFn, internalListenerFn);
};

// Digest ======================================================================

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

  this.$$everyScope(function(scope) {
    var newValue, oldValue;

    _.forEachRight(scope.$$watchers, function(watcher) {
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

Scope.prototype.$$postDigest = function(fn) {
  this.$$postDigestQueue.push(fn);
};

Scope.prototype.$$everyScope = function(fn) {
  return fn(this) && _.every(this.$$children, function(child) {
    return child.$$everyScope(fn);
  });
};

// Apply =======================================================================

Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$root.$digest();
  }
};

Scope.prototype.$applyAsync = function(expr) {
  this.$$applyAsyncQueue.push(_.bind(function() {
    this.$eval(expr);
  }, this));
  if (this.$root.$$applyAsyncId === null) {
    this.$root.$$applyAsyncId = setTimeout(_.bind(function() {
      this.$apply(_.bind(this.$$flushApplyAsync, this));
    }, this), 0);
  }
};

Scope.prototype.$$flushApplyAsync = function() {
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

// Eval ========================================================================

Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

Scope.prototype.$evalAsync = function(expr) {
  if(!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(_.bind(function() {
      if (this.$$asyncQueue.length) {
        this.$root.$digest();
      }
    }, this), 0);
  }
  this.$$asyncQueue.push({ scope: this, expression: expr });
};

// Equality ====================================================================

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

// Phases ======================================================================

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw new Error(this.$$phase + ' already in progress.');
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

// Child Scopes ================================================================

Scope.prototype.$new = function(isolated, parent) {
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
    child.$$listeners = {};
  }

  parent.$$children.push(child);
  child.$parent = parent;
  return child;
};

Scope.prototype.$destroy = function() {
  if (this === this.$root) { return; }

  var siblings = this.$parent.$$children;
  var indexOfThis = siblings.indexOf(this);
  if (indexOfThis >= 0) {
    siblings.splice(indexOfThis, 1);
  }
};

// Events ======================================================================

Scope.prototype.$on = function(eventName, listener) {
  var listeners = this.$$listeners[eventName];
  if (!listeners) {
    listeners = [];
    this.$$listeners[eventName] = listeners;
  }

  listeners.push(listener);
  return function() {
    var index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners[index] = null;
    }
  };
};

Scope.prototype.$emit = function(eventName) {
  var e = { name: eventName },
    listenerArgs = [e].concat(_.rest(arguments));

  var scope = this;
  do {
    scope.$$fireEventOnScope(eventName, listenerArgs);
    scope = scope.$parent;
  } while (scope);

  return e;
};

Scope.prototype.$broadcast = function(eventName) {
  var e = { name: eventName },
    listenerArgs = [e].concat(_.rest(arguments));

  this.$$fireEventOnScope(eventName, listenerArgs);
  return e;
};

Scope.prototype.$$fireEventOnScope = function(eventName, listenerArgs) {
  var listeners = this.$$listeners[eventName] || [];

  var i = 0;
  while (i < listeners.length) {
    if (listeners[i] === null) {
      listeners.splice(i, 1);
    } else {
      listeners[i].apply(null, listenerArgs);
      // only increment when we have not spliced, so we don't skip
      i++;
    }
  }
};
