/* jshint globalstrict: true */
'use strict';

var initWatchVal = {};

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}

Scope.prototype.$watch = function(watchFn, listenerFn) {
    var watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function(){},
        last: initWatchVal
    };

    this.$$watchers.push(watcher);
};

Scope.prototype.$$digestOnce = function() {
    var self = this;
    var newValue, oldValue, dirty = false;
    
    _.each(this.$$watchers, function(watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;

        if (newValue !== oldValue) {
            self.$$lastDirtyWatch = watcher;
            
            watcher.last = newValue;
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
