/* jshint globalstrict: true */
/* global Scope: false */
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
            var listenerFn = function(){};

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

            expect(scope.$digest).toThrow();
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
    });
});
