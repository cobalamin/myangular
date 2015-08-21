var filters = {};

function register(nameOrObj, factory) {
  if (_.isObject(nameOrObj)) {
    return _.map(nameOrObj, function(factory, name) {
      return register(name, factory);
    });
  } else {
    var filter = factory();
    filters[nameOrObj] = filter;
    return filter;
  }
}

function filter(name) {
  return filters[name];
}
