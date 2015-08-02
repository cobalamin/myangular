/* jshint globalstrict: true */
'use strict';

var initWatchVal = {};

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
    var watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function(){},
        valueEq: !!valueEq,
        last: initWatchVal
    };

    this.$$watchers.push(watcher);
    this.$$lastDirtyWatch = null;
};

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

Scope.prototype.$$digestOnce = function() {
    var self = this;
    var newValue, oldValue, dirty = false;
    
    _.each(this.$$watchers, function(watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;

        if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
            self.$$lastDirtyWatch = watcher;

            watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
            watcher.listenerFn(newValue,
                               oldValue === initWatchVal ? newValue : oldValue,
                               self);

            dirty = true;
        } else if (self.$$lastDirtyWatch === watcher) {
            return false;
        }
    });

    return dirty;
};

Scope.prototype.$digest = function() {
    var ttl = 10;
    var dirty;
    this.$$lastDirtyWatch = null;
    
    do {
        dirty = this.$$digestOnce();
        ttl--;
        
        if (dirty && !ttl) {
            throw new Error("10 digest iterations reached!");
        }
    } while (dirty);
};
