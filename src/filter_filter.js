function filterFilter() {
  return function(arr, filterExpr) {
    var predicateFn;
    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    } else if (_.isString(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr);
    } else {
      return arr;
    }

    return _.filter(arr, predicateFn);
  };
}

function deepCompare(actual, expected, comparator) {
  if (_.isObject(actual)) {
    return _.some(actual, function(value) {
      return deepCompare(value, expected, comparator);
    });
  } else {
    return comparator(actual, expected);
  }
}

function createPredicateFn(expr) {
  var expected = expr.toLowerCase();

  function comparator(actual) {
    actual = actual.toLowerCase();
    return ~actual.indexOf(expected);
  }

  return function predicateFn(item) {
    return deepCompare(item, expr, comparator);
  };
}

register('filter', filterFilter);
