function filterFilter() {
  return function(arr, filterExpr) {
    var predicateFn;
    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    } else if (_.isString(filterExpr) ||
               _.isNumber(filterExpr) ||
               _.isBoolean(filterExpr) ||
               _.isNull(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr);
    } else {
      return arr;
    }

    return _.filter(arr, predicateFn);
  };
}

function deepCompare(actual, expected, comparator) {
  if (_.isString(expected) && _.startsWith(expected, '!')) {
    return !deepCompare(actual, expected.substring(1), comparator);
  } else if (_.isObject(actual)) {
    return _.some(actual, function(value) {
      return deepCompare(value, expected, comparator);
    });
  } else {
    return comparator(actual, expected);
  }
}

function createPredicateFn(expr) {
  function comparator(actual, expected) {
    if (_.isUndefined(actual)) {
      return false;
    }
    if (_.isNull(actual) || _.isNull(expected)) {
      return actual === expected;
    }
    expected = String(expected).toLowerCase();
    actual = String(actual).toLowerCase();
    return ~actual.indexOf(expected);
  }

  return function predicateFn(item) {
    return deepCompare(item, expr, comparator);
  };
}

register('filter', filterFilter);
