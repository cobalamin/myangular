function filterFilter() {
  return function(arr, filterExpr, comparator) {
    var predicateFn;
    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    } else if (_.isString(filterExpr) ||
               _.isNumber(filterExpr) ||
               _.isBoolean(filterExpr) ||
               _.isNull(filterExpr) ||
               _.isObject(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr, comparator);
    } else {
      return arr;
    }

    return _.filter(arr, predicateFn);
  };
}

function deepCompare(actual, expected, comparator, matchAnyProperty, inWildcard) {
  if (_.isString(expected) && _.startsWith(expected, '!')) {
    return !deepCompare(actual, expected.substring(1),
                        comparator, matchAnyProperty);
  } else if (_.isArray(actual)) {
    return _.any(actual, function(actualItem) {
      return deepCompare(actualItem, expected, comparator, matchAnyProperty);
    });
  } else if (_.isObject(actual)) {
    if (_.isObject(expected) && !inWildcard) {
      return _.every(
        _.toPlainObject(expected),
        function(expectedVal, expectedKey) {
          if (_.isUndefined(expectedVal)) {
            return true;
          }
          var isWildcard = (expectedKey === '$');
          var actualVal = isWildcard ? actual : actual[expectedKey];
          return deepCompare(actualVal, expectedVal, comparator, isWildcard, isWildcard);
        }
      );
    } else if (matchAnyProperty) {
      return _.some(actual, function(value) {
        return deepCompare(value, expected, comparator, matchAnyProperty);
      });
    } else {
      return comparator(actual, expected);
    }
  } else {
    return comparator(actual, expected);
  }
}

function createPredicateFn(expr, comparator) {
  var shouldMatchPrimitives = _.isObject(expr) && ('$' in expr);

  if (comparator === true) {
    comparator = _.isEqual;
  } else if (!_.isFunction(comparator)) {
    comparator = function (actual, expected) {
      if (_.isUndefined(actual)) {
        return false;
      }
      if (_.isNull(actual) || _.isNull(expected)) {
        return actual === expected;
      }
      expected = String(expected).toLowerCase();
      actual = String(actual).toLowerCase();
      return ~actual.indexOf(expected);
    };
  }

  return function predicateFn(item) {
    if (shouldMatchPrimitives && !_.isObject(item)) {
      return deepCompare(item, expr.$, comparator, false);
    } else {
      return deepCompare(item, expr, comparator, true);
    }
  };
}

register('filter', filterFilter);
