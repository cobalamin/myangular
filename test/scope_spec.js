/* jshint globalstrict: true */
/* global Scope: false, register: false */
'use strict';

describe("Scope", function() {
  it("can be constructed and used as an object", function() {
    var scope = new Scope();
    scope.aProperty = 1;

    expect(scope.aProperty).toBe(1);
  });

  describe("digest", function() {
    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it("calls the listener fn of a watch on first $digest", function() {
      var watchFn = function() { return 'wat'; };
      var listenerFn = jasmine.createSpy();
      scope.$watch(watchFn, listenerFn);

      scope.$digest();

      expect(listenerFn).toHaveBeenCalled();
    });

    it("calls the watch fn with the scope as the argument", function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = _.noop;

      scope.$watch(watchFn, listenerFn);
      scope.$digest();

      expect(watchFn).toHaveBeenCalledWith(scope);

    });

    it("calls the listener fn when the watched value changes", function() {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newVal, oldVal, scope) { scope.counter++; }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("calls listener when value is first undefined", function() {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newVal, oldVal, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("calls listener with new val as old val the first time", function() {
      scope.someValue = 123;
      var oldValueGiven;

      scope.$watch(
        function(scope) { return scope.someValue; },
        function(newVal, oldVal, scope) { oldValueGiven = oldVal; }
      );

      scope.$digest();
      expect(oldValueGiven).toBe(123);
    });

    it("may have watchers that omit the listener fn", function() {
      var watchFn = jasmine.createSpy().and.returnValue('something');
      scope.$watch(watchFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalled();
    });

    it("triggers chained watchers in the same digest", function() {
      scope.name = 'Jane';

      scope.$watch(
        function(scope) { return scope.nameUpper; },
        function(newVal, oldVal, scope) {
          if(newVal) {
            scope.initial = newVal.substring(0, 1) + '.';
          }
        }
      );

      scope.$watch(
        function(scope) { return scope.name; },
        function(newVal, oldVal, scope) {
          if(newVal) {
            scope.nameUpper = newVal.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');
    });

    it("gives up on all watches after 10 iterations", function() {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        function(scope) { return scope.counterA; },
        function(newVal, oldVal, scope) {
          scope.counterB++;
        }
      );

      scope.$watch(
        function(scope) { return scope.counterB; },
        function(newVal, oldVal, scope) {
          scope.counterA++;
        }
      );

      expect(function() { scope.$digest(); }).toThrow();
    });

    it("ends the digest when the last watch is clean", function() {
      scope.array = _.range(100);
      var watchExecutions = 0;

      _.times(100, function(i) {
        scope.$watch(
          function(scope) {
            watchExecutions++;
            return scope.array[i];
          },
          function() {}
        );
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 420;
      scope.$digest();
      expect(watchExecutions).toBe(301);
    });

    it("does not end digest so that new watches are not run", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newValue, oldValue, scope) {
          scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
              scope.counter++;
            }
          );
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("compares based on value if enabled", function() {
      scope.aValue = [1,2,3];
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) { scope.counter++; },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("correctly handles NaNs", function() {
      scope.number = NaN;
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.number; },
        function(newVal, oldVal, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("executes $eval'd function and returns result", function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    });

    it("passes the second $eval argument straight through", function() {
      scope.aValue = 42;

      var  result = scope.$eval(function(scope, arg) {
        return scope.aValue + arg;
      }, 2);

      expect(result).toBe(44);
    });

    it("executes $apply'd fn and starts the digest", function() {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) { scope.counter++; }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(function(scope) {
        scope.aValue = 'someOtherValue';
      });
      expect(scope.counter).toBe(2);
    });

    it("executes $evalAsync'd fn later in the same cycle", function() {
      scope.aValue = [1,2,3];
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvaluated = true;
          });
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    });

    it("executes $evalAsync'd fns added by watch functions", function() {
      scope.aValue = [1,2,3];
      scope.asyncEvaluated = false;

      scope.$watch(
        function(scope) {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluated = true;
            });
          }
          return scope.aValue;
        },
        _.noop
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
    });

    it("executes $evalAsync'd fns even when not dirty", function() {
      scope.aValue = [1,2,3];
      scope.asyncEvaluatedTimes = 0;

      scope.$watch(
        function(scope) {
          if (scope.asyncEvaluatedTimes < 2) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluatedTimes++;
            });
          }
          return scope.aValue;
        },
        _.noop
      );

      scope.$digest();
      expect(scope.asyncEvaluatedTimes).toBe(2);
    });

    it("eventually halts $evalAsyncs added by watches", function() {
      scope.aValue = [1,2,3];
      scope.$watch(
        function(scope) {
          scope.$evalAsync(_.noop);
          return scope.aValue;
        },
        _.noop
      );

      expect(function() { scope.$digest(); }).toThrow();
    });

    it("has a $$phase field whose value is the current digest phase", function() {
      scope.aValue = [1,2,3];

      scope.$watch(
        function(scope) {
          scope.phaseInWatch = scope.$$phase;
          return scope.aValue;
        },
        function(newVal, oldVal, scope) {
          scope.phaseInListener = scope.$$phase;
        }
      );

      scope.$apply(function(scope) {
        scope.phaseInApply = scope.$$phase;
      });

      expect(scope.phaseInWatch).toBe('$digest');
      expect(scope.phaseInListener).toBe('$digest');
      expect(scope.phaseInApply).toBe('$apply');
    });

    it("schedules a digest in $evalAsync", function(done) {
      scope.aValue = "abc";
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$evalAsync(_.noop);
      expect(scope.counter).toBe(0);
      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 0);
    });

    it("allows async $apply with $applyAsync", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$applyAsync(function(scope) {
        scope.aValue = 'abc';
      });
      expect(scope.counter).toBe(1);

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 0);
    });

    it("never executes $applyAsync'd fn in the same cycle", function(done) {
      scope.aValue = [1,2,3];
      scope.asyncApplied = false;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.$applyAsync(function(scope) {
            scope.asyncApplied = true;
          });
        }
      );

      scope.$digest();
      expect(scope.asyncApplied).toBe(false);
      setTimeout(function() {
        expect(scope.asyncApplied).toBe(true);
        done();
      }, 0);
    });

    it("coalesces many calls to $applyAsync", function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          scope.counter++;
          return scope.aValue;
        },
        function(newVal, oldVal, scope) {}
      );

      scope.$applyAsync(function(scope) {
        scope.aValue = 'abc';
      });
      scope.$applyAsync(function(scope) {
        scope.aValue = 'def';
      });

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 0);
    });

    it('cancels and flushes $applyAsync if digested first', function(done) {
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          scope.counter++;
          return scope.aValue;
        },
        _.noop
      );

      scope.$applyAsync(function(scope) {
        scope.aValue = 'abc';
      });
      scope.$applyAsync(function(scope) {
        scope.aValue = 'def';
      });

      scope.$digest();
      expect(scope.counter).toBe(2);
      expect(scope.aValue).toEqual('def');

      setTimeout(function() {
        expect(scope.counter).toBe(2);
        done();
      }, 0);
    });

    it("runs a $$postDigest fn after each digest", function() {
      scope.counter = 0;

      scope.$$postDigest(function() {
        scope.counter++;
      });

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("does not include $$postDigest in the digest", function() {
      scope.aValue = 'original value';

      scope.$$postDigest(function() {
        scope.aValue = 'changed value';
      });

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newVal, oldVal, scope) {
          scope.watchedValue = newVal;
        }
      );

      scope.$digest();
      expect(scope.watchedValue).toBe('original value');

      scope.$digest();
      expect(scope.watchedValue).toBe('changed value');
    });

    it("catches exceptions in watch fns and continues", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { throw new Error("Error"); },
        _.noop
      );
      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("catches exceptions in listener fns and continues", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) { throw new Error("Error"); }
      );
      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("catches exceptions in $evalAsync", function(done) {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$evalAsync(function(scope) {
        throw new Error("Error");
      });
      setTimeout(function() {
        expect(scope.counter).toBe(1);
        done();
      }, 0);
    });

    it("catches exceptions in $applyAsync", function(done) {
      scope.$applyAsync(function(scope) {
        throw new Error("Error");
      });
      scope.$applyAsync(function(scope) {
        throw new Error("Error");
      });
      scope.$applyAsync(function(scope) {
        scope.applied = true;
      });

      setTimeout(function() {
        expect(scope.applied).toBe(true);
        done();
      }, 0);
    });

    it("catches exceptions in $$postDigest", function() {
      var didRun = false;

      scope.$$postDigest(function() {
        throw new Error("Error");
      });
      scope.$$postDigest(function() {
        didRun = true;
      });

      scope.$digest();
      expect(didRun).toBe(true);
    });

    it("allows destroying a $watch with a removal function", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      var destroyWatch = scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.aValue = 'ghi';
      destroyWatch();
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("allows destroying a $watch during digest", function() {
      scope.aValue = 'abc';

      var watchCalls = [];

      scope.$watch(
        function(scope) {
          watchCalls.push('first');
          return scope.aValue;
        }
      );
      var destroyWatch = scope.$watch(
        function(scope) {
          watchCalls.push('second');
          destroyWatch();
        }
      );
      scope.$watch(
        function(scope) {
          watchCalls.push('third');
          return scope.aValue;
        }
      );

      scope.$digest();
      expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
    });

    it("allows a $watch to destroy another during digest", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newVal, oldVal, scope) {
          destroyWatch();
        }
      );

      var destroyWatch = scope.$watch(_.noop, _.noop);

      scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("allows destroying several $watches during digest", function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      var destroyWatch1 = scope.$watch(
        function(scope) {
          destroyWatch1();
          destroyWatch2();
        }
      );
      var destroyWatch2 = scope.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(0);
    });

    it("accepts expressions for watch functions", function() {
      var theValue;

      scope.aValue = 42;
      scope.$watch('aValue', function(newVal, oldVal, scope) {
        theValue = newVal;
      });
      scope.$digest();

      expect(theValue).toBe(42);
    });

    it("accepts expressions in $eval", function() {
      expect(scope.$eval('42')).toBe(42);
    });

    it("accepts expressions in $apply", function() {
      scope.aFunction = _.constant(42);
      expect(scope.$apply('aFunction()')).toBe(42);
    });

    it("accepts expressions in $evalAsync", function(done) {
      var called;
      scope.aFunction = function() {
        called = true;
      };

      scope.$evalAsync('aFunction()');

      scope.$$postDigest(function() {
        expect(called).toBe(true);
        done();
      });
    });

    it("removes constant watches after first invocation", function() {
      scope.$watch('[1,2,3]', _.noop);
      scope.$digest();

      expect(scope.$$watchers.length).toBe(0);
    });

    it("accepts one-time watches", function() {
      var theValue;

      scope.aValue = 42;
      scope.$watch('::aValue', function(newVal, oldVal, scope) {
        theValue = newVal;
      });
      scope.$digest();

      expect(theValue).toBe(42);
    });

    it("removes one-time watches after first invocation", function() {
      scope.aValue = 42;
      scope.$watch('::aValue', _.noop);
      scope.$digest();

      expect(scope.$$watchers.length).toBe(0);
    });

    it("does not remove one-time watches until value is something other than undefined", function() {
      scope.$watch('::aValue', _.noop);

      scope.$digest();
      expect(scope.$$watchers.length).toBe(1);

      scope.aValue = 42;
      scope.$digest();
      expect(scope.$$watchers.length).toBe(0);
    });

    it("does not remove one-time watches until value has stabilised", function() {
      scope.aValue = 42;

      scope.$watch('::aValue', _.noop);
      var unwatchDeleter = scope.$watch('aValue', function() {
        delete scope.aValue;
      });

      scope.$digest();
      expect(scope.$$watchers.length).toBe(2);

      scope.aValue = 42;
      unwatchDeleter();
      scope.$digest();
      expect(scope.$$watchers.length).toBe(0);
    });

    it("does not remove one-time watches before all array items are defined", function() {
      scope.$watch('::[1,2,aValue]', _.noop, true);

      scope.$digest();
      expect(scope.$$watchers.length).toBe(1);

      scope.aValue = 3;
      scope.$digest();
      expect(scope.$$watchers.length).toBe(0);
    });

    it("does not remove one-time watches before all object vals are defined", function() {
      scope.$watch('::{a: 1, b: aValue}', _.noop, true);

      scope.$digest();
      expect(scope.$$watchers.length).toBe(1);

      scope.aValue = 3;
      scope.$digest();
      expect(scope.$$watchers.length).toBe(0);
    });

    it("does not reevaluate an array if its contents do not change", function() {
      var values = [];

      scope.a = 1; scope.b = 2; scope.c = 3;
      scope.$watch('[a,b,c]', function(value) {
        values.push(value);
      });

      scope.$digest();
      expect(values.length).toBe(1);
      expect(values[0]).toEqual([1,2,3]);

      scope.$digest();
      expect(values.length).toBe(1);

      scope.c = 4;
      scope.$digest();
      expect(values.length).toBe(2);
      expect(values[1]).toEqual([1,2,4]);
    });

    it("allows $stateful filter value to change over time", function(done) {

      register('withTime', function() {
        return _.extend(function(v) {
          return new Date().toISOString() + ": " + v;
        }, { $stateful: true });
      });

      var listenerSpy = jasmine.createSpy();
      scope.$watch('42 | withTime', listenerSpy);
      scope.$digest();
      var firstValue = listenerSpy.calls.mostRecent().args[0];

      setTimeout(function() {
        scope.$digest();
        var secondValue = listenerSpy.calls.mostRecent().args[0];
        expect(secondValue).not.toEqual(firstValue);
        done();
      }, 100);
    });
  });

  describe('$watchGroup', function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    it("takes watches as an array and calls listener with arrays", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.bValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.bValue; }
      ], function(newVals, oldVals, scope) {
        gotNewValues = newVals;
        gotOldValues = oldVals;
      });

      scope.$digest();
      expect(gotNewValues).toEqual([1,2]);
      expect(gotOldValues).toEqual([1,2]);
    });

    it("only calls listener once per digest", function() {
      var counter = 0;

      scope.aValue = 1;
      scope.bValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.bValue; }
      ], function(newVals, oldVals, scope) {
        counter++;
      });

      scope.$digest();
      expect(counter).toEqual(1);
    });

    it("uses the same array of old and new values on first run", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newVals, oldVals, scope) {
        gotNewValues = newVals;
        gotOldValues = oldVals;
      });

      scope.$digest();
      expect(gotNewValues).toBe(gotOldValues);
    });

    it("uses different arrays for old and new values on subsequent runs", function() {
      var gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.anotherValue; }
      ], function(newVals, oldVals, scope) {
        gotNewValues = newVals;
        gotOldValues = oldVals;
      });

      scope.$digest();

      scope.anotherValue = 3;
      scope.$digest();

      expect(gotNewValues).not.toBe(gotOldValues);
      expect(gotNewValues).toEqual([1, 3]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it("calls the listener once when the watch array is empty", function() {
      var gotNewValues, gotOldValues;

      scope.$watchGroup([], function(newVals, oldVals, scope) {
        gotNewValues = newVals;
        gotOldValues = oldVals;
      });

      scope.$digest();
      expect(gotNewValues).toEqual([]);
      expect(gotOldValues).toEqual([]);
    });

    it("can be deregistered", function() {
      var counter = 0;

      scope.aValue = 1;
      scope.bValue = 2;

      var destroyGroup = scope.$watchGroup([
        function(scope) { return scope.aValue; },
        function(scope) { return scope.bValue; }
      ], function(newVals, oldVals, scope) {
        counter++;
      });

      scope.$digest();

      scope.anotherValue = 3;
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(1);
    });

    it("does not call the zero-watch listener when deregistered first", function() {
      var counter = 0;

      var destroyGroup = scope.$watchGroup([], function(newVals, oldVals, scope) {
        counter++;
      });
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(0);
    });
  });

  describe("inheritance", function() {
    var parent;
    beforeEach(function() {
      parent = new Scope();
    });

    it("inherits the parent's properties", function() {
      parent.aValue = [1,2,3];

      var child = parent.$new();
      expect(child.aValue).toEqual([1,2,3]);
    });

    it("does not cause a parent to inherit its properties", function() {
      var child = parent.$new();
      child.aValue = [1,2,3];

      expect(parent.aValue).toBeUndefined();
    });

    it("inherits the parent's properties whenever they are defined", function() {
      var child = parent.$new();
      parent.aValue = [1,2,3];

      expect(child.aValue).toEqual([1,2,3]);
    });

    it("can manipulate a parent scope's property", function() {
      var child = parent.$new();
      parent.aValue = [1,2,3];

      child.aValue.push(4);
      expect(child.aValue).toEqual([1,2,3,4]);
      expect(parent.aValue).toEqual([1,2,3,4]);
    });

    it("can watch a property in the parent", function() {
      var child = parent.$new();
      parent.aValue = [1,2,3];
      child.counter = 0;

      child.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        },
        true
      );

      child.$digest();
      expect(child.counter).toBe(1);

      parent.aValue.push(4);
      child.$digest();
      expect(child.counter).toBe(2);
    });

    it("can be nested at any depth", function() {
      var a = new Scope();
      var aa = a.$new();
      var aaa = aa.$new();
      var aab = aa.$new();
      var ab = a.$new();
      var abb = ab.$new();

      a.value = 1;

      expect(aa.value).toBe(1);
      expect(aaa.value).toBe(1);
      expect(aab.value).toBe(1);
      expect(ab.value).toBe(1);
      expect(abb.value).toBe(1);

      ab.anotherValue = 2;

      expect(abb.anotherValue).toBe(2);
      expect(aa.anotherValue).toBeUndefined();
      expect(aaa.anotherValue).toBeUndefined();
    });

    it("shadows a parent's property with the same name", function() {
      var child = parent.$new();

      parent.name = "Joe";
      child.name = "Jill";

      expect(child.name).toBe("Jill");
      expect(parent.name).toBe("Joe");
    });

    it("does not shadow members of parent scope's attributes", function() {
      var child = parent.$new();

      parent.user = { name: "Joe" };
      child.user.name = "Jill";

      expect(child.user.name).toBe("Jill");
      expect(parent.user.name).toBe("Jill");
    });

    it("does not digest its parent(s)", function() {
      var child = parent.$new();

      parent.aValue = "abc";
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.aValueWas = newVal;
        }
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    });

    it("keeps a record of its children", function() {
      var child1 = parent.$new();
      var child2 = parent.$new();
      var child2_1 = child2.$new();

      expect(parent.$$children.length).toBe(2);
      expect(parent.$$children[0]).toBe(child1);
      expect(parent.$$children[1]).toBe(child2);

      expect(child1.$$children.length).toBe(0);

      expect(child2.$$children.length).toBe(1);
      expect(child2.$$children[0]).toBe(child2_1);
    });

    it("digests its children", function() {
      var child = parent.$new();

      parent.aValue = "abc";
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.aValueWas = newVal;
        }
      );

      parent.$digest();
      expect(child.aValueWas).toBe("abc");
    });

    it("digests from root on $apply", function() {
      var child = parent.$new();
      var child2 = child.$new();

      parent.aValue = 'abc';
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      child2.$apply(_.noop);

      expect(parent.counter).toBe(1);
    });

    it("schedules a digest from root on $evalAsync", function(done) {
      var grandchild = (parent.$new()).$new();

      parent.aValue = "abc";
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      grandchild.$evalAsync(_.noop);

      setTimeout(function() {
        expect(parent.counter).toBe(1);
        done();
      }, 0);
    });

    it("does not have access to parent attributes when isolated", function() {
      var child = parent.$new(true);
      parent.aValue = "abc";

      expect(child.aValue).toBeUndefined();
    });

    it("cannot watch parent attributes when isolated", function() {
      var child = parent.$new(true);

      parent.aValue = 'abc';
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.aValueWas = newVal;
        }
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    });

    it("digests its isolated children", function() {
      var child = parent.$new(true);

      child.aValue = "abc";
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.aValueWas = newVal;
        }
      );

      parent.$digest();
      expect(child.aValueWas).toBe("abc");
    });

    it("digests from root on $apply when isolated", function() {
      var grandchild = (parent.$new(true)).$new();

      parent.aValue = "abc";
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      grandchild.$apply(_.noop);

      expect(parent.counter).toBe(1);
    });

    it("schedules a digest from root on $evalAsync when isolated", function(done) {
      var grandchild = (parent.$new(true)).$new();

      parent.aValue = "abc";
      parent.counter = 0;
      parent.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      grandchild.$evalAsync(_.noop);

      setTimeout(function() {
        expect(parent.counter).toBe(1);
        done();
      }, 0);
    });

    it("executes $evalAsync fns on isolated scopes", function(done) {
      var child = parent.$new(true);

      child.$evalAsync(function(scope) {
        scope.didEvalAsync = true;
      });

      setTimeout(function() {
        expect(child.didEvalAsync).toBe(true);
        done();
      }, 0);
    });

    it("executes $$postDigest fns on isolated scopes", function() {
      var child = parent.$new(true);

      child.$$postDigest(function() {
        child.didPostDigest = true;
      });
      parent.$digest();

      expect(child.didPostDigest).toBe(true);
    });

    it("can take some other scope as the parent", function() {
      var prototypeParent = new Scope();
      var hierarchyParent = new Scope();
      var child = prototypeParent.$new(false, hierarchyParent);

      prototypeParent.a = 42;
      expect(child.a).toBe(42);

      child.counter = 0;
      child.$watch(function(scope) {
        scope.counter++;
      });

      prototypeParent.$digest();
      expect(child.counter).toBe(0);

      hierarchyParent.$digest();
      expect(child.counter).toBe(2);
    });

    it("is no longer digested when $destroy has been called", function() {
      var child = parent.$new();

      child.aValue = [1,2,3];
      child.counter = 0;
      child.$watch(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        },
        true
      );

      parent.$digest();
      expect(child.counter).toBe(1);

      child.aValue.push(4);
      parent.$digest();
      expect(child.counter).toBe(2);

      child.$destroy();
      child.aValue.push(5);
      parent.$digest();
      expect(child.counter).toBe(2);
    });
  });

  describe("$watchCollection", function() {
    var scope;
    beforeEach(function() {
      scope = new Scope();
    });

    it("works like a normal watch for non-collections", function() {
      var valueProvided;

      scope.aValue = 42;
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          valueProvided = newVal;
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
      expect(valueProvided).toBe(scope.aValue);

      scope.aValue = 43;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("works like a normal watch for NaNs", function() {
      scope.aValue = NaN;
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("notices when the value becomes an array", function() {
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr = [1,2,3];
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices an item being added to an array", function() {
      scope.arr = [1,2,3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices an item removed from an array", function() {
      scope.arr = [1,2,3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.shift();
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices an item replaced in an array", function() {
      scope.arr = [1,2,3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr[1] = 42;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices items reordered in an array", function() {
      scope.arr = [2,1,3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.sort();
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("does not fail on NaNs in arrays", function() {
      scope.arr = [2, NaN, 3];
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arr; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("notices a replaced item in an arguments object", function() {
      (function() {
        scope.arrayLike = arguments;
      })(1,2,3);
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arrayLike[1] = 42;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices an item replaced in a NodeList object", function() {
      document.documentElement.appendChild(document.createElement('div'));
      scope.arrayLike = document.getElementsByTagName('div');

      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.arrayLike; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices when the value becomes an object", function() {
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj = { a: 1 };
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices when an attribute is added to an object", function() {
      scope.counter = 0;
      scope.obj = { a: 1 };

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj.b = 2;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("notices when an attribute is changed in an object", function() {
      scope.counter = 0;
      scope.obj = { a: 1 };

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj.a = 2;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("does not fail on NaN attributes in objects", function() {
      scope.counter = 0;
      scope.obj = { a: NaN };

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it("notices when an attribute is removed from an object", function() {
      scope.counter = 0;
      scope.obj = { a: 1 };

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      delete scope.obj.a;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("does not consider any simple object with a length property an array", function() {
      scope.obj = { length: 42, otherKey: 'abc' };
      scope.counter = 0;

      scope.$watchCollection(
        function(scope) { return scope.obj; },
        function(newVal, oldVal, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.obj.newKey = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it("gives the old non-collection value to listener", function() {
      scope.aValue = 42;
      var oldValueGiven;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          oldValueGiven = oldVal;
        }
      );

      scope.$digest();

      scope.aValue = 43;
      scope.$digest();

      expect(oldValueGiven).toBe(42);
    });

    it("gives the old array value to listeners", function() {
      scope.aValue = [1,2,3];
      var oldValueGiven;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          oldValueGiven = oldVal;
        }
      );

      scope.$digest();

      scope.aValue.push(4);
      scope.$digest();

      expect(oldValueGiven).toEqual([1,2,3]);
    });

    it("gives the old object value to listeners", function() {
      scope.aValue = {a: 1, b: 2};
      var oldValueGiven;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          oldValueGiven = oldVal;
        }
      );

      scope.$digest();

      scope.aValue.c = 3;
      scope.$digest();

      expect(oldValueGiven).toEqual({a: 1, b: 2});
    });

    it("uses the new value as the old value on first digest", function() {
      scope.aValue = {a: 1, b: 2};
      var oldValueGiven;

      scope.$watchCollection(
        function(scope) { return scope.aValue; },
        function(newVal, oldVal, scope) {
          oldValueGiven = oldVal;
        }
      );

      scope.$digest();
      expect(oldValueGiven).toEqual({a: 1, b: 2});
    });

    it("accepts expressions for watch functions", function() {
      var theValue;

      scope.aColl = [1,2,3];
      scope.$watchCollection('aColl', function(newVal, oldVal, scope) {
        theValue = newVal;
      });
      scope.$digest();

      expect(theValue).toEqual([1,2,3]);
    });
  });

  describe("Events", function() {
    var parent, scope;
    var child, isolatedChild;

    beforeEach(function() {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it("allows registering listeners", function() {
      var l1 = _.noop;
      var l2 = _.noop;
      var l3 = _.noop;

      scope.$on('someEvent', l1);
      scope.$on('someEvent', l2);
      scope.$on('someOtherEvent', l3);

      expect(scope.$$listeners).toEqual({
        someEvent: [l1, l2],
        someOtherEvent: [l3]
      });
    });

    it("registers different listeners for every scope", function() {
      var l1 = _.noop;
      var l2 = _.noop;
      var l3 = _.noop;

      scope.$on('someEvent', l1);
      child.$on('someEvent', l2);
      isolatedChild.$on('someEvent', l3);

      expect(scope.$$listeners).toEqual({ someEvent: [l1] });
      expect(child.$$listeners).toEqual({ someEvent: [l2] });
      expect(isolatedChild.$$listeners).toEqual({ someEvent: [l3] });
    });

    _.each(['$emit', '$broadcast'], function(method) {
      describe(method, function() {
        it("calls the listeners of the matching event", function() {
          var l1 = jasmine.createSpy();
          var l2 = jasmine.createSpy();
          scope.$on('someEvent', l1);
          scope.$on('someOtherEvent', l2);

          scope[method]('someEvent');

          expect(l1).toHaveBeenCalled();
          expect(l2).not.toHaveBeenCalled();
        });

        it("passes an event object with a name to listeners", function() {
          var l = jasmine.createSpy();
          scope.$on('someEvent', l);

          scope[method]('someEvent');

          expect(l).toHaveBeenCalled();
          expect(l.calls.mostRecent().args[0].name).toEqual('someEvent');
        });

        it("passes the same event object to each listener", function() {
          var l1 = jasmine.createSpy();
          var l2 = jasmine.createSpy();
          scope.$on('someEvent', l1);
          scope.$on('someEvent', l2);

          scope[method]('someEvent');

          var e1 = l1.calls.mostRecent().args[0];
          var e2 = l2.calls.mostRecent().args[0];

          expect(e1).toBe(e2);
        });

        it("passes additional arguments to listeners", function() {
          var l = jasmine.createSpy();
          scope.$on('someEvent', l);

          scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');

          expect(l.calls.mostRecent().args[1]).toEqual('and');
          expect(l.calls.mostRecent().args[2]).toEqual(['additional', 'arguments']);
          expect(l.calls.mostRecent().args[3]).toEqual('...');
        });

        it("returns the event object", function() {
          var returnedEvent = scope[method]('someEvent');

          expect(returnedEvent).toBeDefined();
          expect(returnedEvent.name).toEqual('someEvent');
        });

        it("can be deregistered", function() {
          var l = jasmine.createSpy();
          var deregister = scope.$on('someEvent', l);

          deregister();

          scope[method]('someEvent');

          expect(l).not.toHaveBeenCalled();
        });

        it("does not skip the next listener when removed", function() {
          var deregister;

          var listener = function() {
            deregister();
          };
          var nextListener = jasmine.createSpy();

          deregister = scope.$on('someEvent', listener);
          scope.$on('someEvent', nextListener);

          scope[method]('someEvent');

          expect(nextListener).toHaveBeenCalled();
        });

        it("sets defaultPrevented when preventDefault is called", function() {
          var l = function(e) {
            e.preventDefault();
          };
          scope.$on('someEvent', l);

          var event = scope[method]('someEvent');
          expect(event.defaultPrevented).toBe(true);
        });

        it("does not stop on exceptions", function() {
          var l1 = function(e) {
            throw new Error('listener 1 throwing an exception');
          };
          var l2 = jasmine.createSpy();
          scope.$on('someEvent', l1);
          scope.$on('someEvent', l2);

          scope[method]('someEvent');

          expect(l2).toHaveBeenCalled();
        });
      });
    });

    describe("$emit", function() {
      it("propagates up the scope hierarchy", function() {
        var parentListener = jasmine.createSpy();
        var scopeListener = jasmine.createSpy();

        parent.$on('someEvent', parentListener);
        scope.$on('someEvent', scopeListener);

        scope.$emit('someEvent');

        expect(scopeListener).toHaveBeenCalled();
        expect(parentListener).toHaveBeenCalled();
      });

      it("propagates the same event up", function() {
        var parentListener = jasmine.createSpy();
        var scopeListener = jasmine.createSpy();

        parent.$on('someEvent', parentListener);
        scope.$on('someEvent', scopeListener);

        scope.$emit('someEvent');

        var scopeEvent = scopeListener.calls.mostRecent().args[0];
        var parentEvent = parentListener.calls.mostRecent().args[0];
        expect(scopeEvent).toBe(parentEvent);
      });

      it("attaches targetScope", function() {
        var scopeListener = jasmine.createSpy();
        var parentListener = jasmine.createSpy();

        scope.$on('someEvent', scopeListener);
        parent.$on('someEvent', parentListener);

        scope.$emit('someEvent');
        expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
        expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      });

      it("attaches currentScope", function() {
        var currentScopeOnScope, currentScopeOnParent;
        var scopeListener = function(e) {
          currentScopeOnScope = e.currentScope;
        };
        var parentListener = function(e) {
          currentScopeOnParent = e.currentScope;
        };

        scope.$on('someEvent', scopeListener);
        parent.$on('someEvent', parentListener);

        scope.$emit('someEvent');

        expect(currentScopeOnScope).toBe(scope);
        expect(currentScopeOnParent).toBe(parent);
      });

      it("sets currentScope to null after propagation", function() {
        var event;
        var scopeListener = function(e) {
          event = e;
        };
        scope.$on('someEvent', scopeListener);

        scope.$emit('someEvent');

        expect(event.currentScope).toBe(null);
      });

      it("does not propagate to parents when stopped", function() {
        var scopeListener = function(e) {
          e.stopPropagation();
        };
        var parentListener = jasmine.createSpy();

        scope.$on('someEvent', scopeListener);
        parent.$on('someEvent', parentListener);

        scope.$emit('someEvent');
        expect(parentListener).not.toHaveBeenCalled();
      });

      it("does pass the event to all listeners on the current scope after being stopped", function() {
        var l1 = function(e) {
          e.stopPropagation();
        };
        var l2 = jasmine.createSpy();

        scope.$on('someEvent', l1);
        scope.$on('someEvent', l2);

        scope.$emit('someEvent');

        expect(l2).toHaveBeenCalled();
      });
    });

    describe("$broadcast", function() {
      it("propagates down the scope hierarchy", function() {
        var scopeListener = jasmine.createSpy();
        var childListener = jasmine.createSpy();
        var isolatedChildListener = jasmine.createSpy();

        scope.$on('someEvent', scopeListener);
        child.$on('someEvent', childListener);
        isolatedChild.$on('someEvent', isolatedChildListener);

        scope.$broadcast('someEvent');

        expect(scopeListener).toHaveBeenCalled();
        expect(childListener).toHaveBeenCalled();
        expect(isolatedChildListener).toHaveBeenCalled();
      });

      it("propagates the same event down", function() {
        var scopeListener = jasmine.createSpy();
        var childListener = jasmine.createSpy();

        scope.$on('someEvent', scopeListener);
        scope.$on('someEvent', childListener);

        scope.$broadcast('someEvent');

        var scopeEvent = scopeListener.calls.mostRecent().args[0];
        var childEvent = childListener.calls.mostRecent().args[0];
        expect(scopeEvent).toBe(childEvent);
      });

      it("attaches targetScope", function() {
        var scopeListener = jasmine.createSpy();
        var childListener = jasmine.createSpy();

        scope.$on('someEvent', scopeListener);
        child.$on('someEvent', childListener);

        scope.$broadcast('someEvent');
        expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
        expect(childListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      });

      it("attaches currentScope", function() {
        var currentScopeOnScope, currentScopeOnChild;
        var scopeListener = function(e) {
          currentScopeOnScope = e.currentScope;
        };
        var childListener = function(e) {
          currentScopeOnChild = e.currentScope;
        };

        scope.$on('someEvent', scopeListener);
        child.$on('someEvent', childListener);

        scope.$broadcast('someEvent');

        expect(currentScopeOnScope).toBe(scope);
        expect(currentScopeOnChild).toBe(child);
      });

      it("sets currentScope to null after propagation", function() {
        var event;
        var scopeListener = function(e) {
          event = e;
        };
        scope.$on('someEvent', scopeListener);

        scope.$broadcast('someEvent');

        expect(event.currentScope).toBe(null);
      });
    });

    it("fires $destroy when destroyed", function() {
      var l = jasmine.createSpy();
      scope.$on('$destroy', l);

      scope.$destroy();
      expect(l).toHaveBeenCalled();
    });

    it("fires $destroy on children destroyed", function() {
      var l = jasmine.createSpy();
      child.$on('$destroy', l);

      scope.$destroy();
      expect(l).toHaveBeenCalled();
    });
  });
});
