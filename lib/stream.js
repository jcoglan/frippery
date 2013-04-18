var EventEmitter = require('events').EventEmitter,
    util = require('util');

var COMPARE = function(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
};

var tofn = function(listener, context) {
  if (typeof listener === 'function')
    return context ? listener.bind(context) : listener;
  else
    return function() { return listener };
};

var Stream = function() {};
util.inherits(Stream, EventEmitter);

// push :: Stream a -> a -> ()
Stream.prototype.push = function(value) {
  if (!this._stopped)
    this.emit('data', value);
};

// end :: Stream a -> ()
Stream.prototype.end = function() {
  this._stopped = true;
  this.emit('end');
};

// listen :: Stream a -> (a -> ()) -> ()
Stream.prototype.listen = function(listener, context) {
  this.on('data', tofn(listener, context));
};

// map :: Stream a -> (a -> b) -> Stream b
Stream.prototype.map = function(listener, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(listener, context);

  this.listen(function(value) { stream.push(fn(value)) });
  return stream;
};

// filter :: Stream a -> (a -> Bool) -> Stream a
Stream.prototype.filter = function(predicate, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(predicate, context);

  this.listen(function(value) {
    if (fn(value)) stream.push(value);
  });
  return stream;
};

// fold :: Stream a -> (b -> a -> b) -> b -> Stream b
Stream.prototype.fold = function(reducer, seed) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(reducer, null);

  this.listen(function(value) {
    if (seed === undefined)
      seed = value;
    else
      seed = fn(seed, value);

    stream.push(seed);
  });
  return stream;
};
Stream.prototype.reduce = Stream.prototype.fold;

// take :: Stream a -> Int -> Stream a
Stream.prototype.take = function(n) {
  var stream = new this.constructor(null, [this]);
  this.listen(function(value) {
    if (n-- > 0) stream.push(value);
  });
  return stream;
};

// takeWhile :: Stream a -> (a -> Bool) -> Stream a
Stream.prototype.takeWhile = function(predicate, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(predicate, context),
      active = true;

  this.listen(function(value) {
    active = active && fn(value);
    if (active) stream.push(value);
  });
  return stream;
};

// drop :: Stream a -> Int -> Stream a
Stream.prototype.drop = function(n) {
  var stream = new this.constructor(null, [this]);
  this.listen(function(value) {
    if (n-- <= 0) stream.push(value);
  });
  return stream;
};

// dropWhile :: Stream a -> (a -> Bool) -> Stream a
Stream.prototype.dropWhile = function(predicate, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(predicate, context),
      active = false;

  this.listen(function(value) {
    active = active || !fn(value);
    if (active) stream.push(value);
  });
  return stream;
};

// max :: Stream a -> (a -> a -> Int) -> Stream a
Stream.prototype.max = function(comparator, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(comparator || COMPARE, context),
      max,
      newMax;

  this.listen(function(value) {
    if (max === undefined || fn(max, value) > 0)
      newMax = value;

    if (newMax !== max) {
      max = newMax;
      stream.push(max);
    }
  });
  return stream;
};

// min :: Stream a -> (a -> a -> Int) -> Stream a
Stream.prototype.min = function(comparator, context) {
  var stream = new this.constructor(null, [this]),
      fn     = tofn(comparator || COMPARE, context),
      min,
      newMin;

  this.listen(function(value) {
    if (min === undefined || fn(min, value) < 0)
      newMin = value;

    if (newMin !== min) {
      min = newMin;
      stream.push(min);
    }
  });
  return stream;
};

// merge :: Stream a -> Stream b -> Stream (a | b)
Stream.prototype.merge = function(other) {
  var stream = new this.constructor(null, [this, other]);
  this.listen(stream.push, stream);
  other.listen(stream.push, stream);
  return stream;
};

// partition :: Stream a -> (a -> Bool) -> (Stream a, Stream a)
Stream.prototype.partition = function(predicate, context) {
  var trueStream  = new this.constructor(null, [this]),
      falseStream = new this.constructor(null, [this]),
      fn          = tofn(predicate, context);

  this.listen(function(value) {
    if (fn(value))
      trueStream.push(value);
    else
      falseStream.push(value);
  });
  return [trueStream, falseStream];
};
Stream.prototype.fork = Stream.prototype.partition;

// classify :: Stream a -> (a -> b) -> Map b (Stream a)
Stream.prototype.classify = function(listener, context) {
  var map = new Map(this),
      fn  = tofn(listener, context);

  this.listen(function(value) {
    var result = fn(value);
    map.get(result).push(value);
  });
  return map;
};

var Map = function(parent) {
  this._parent  = parent;
  this._streams = {};
};

Map.prototype.get = function(value) {
  var s = this._streams;
  return s[value] = s[value]
                 || new this._parent.constructor(null, [this._parent]);
};

exports.Stream = Stream;

