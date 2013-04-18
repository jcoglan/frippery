var Stream = require('../lib/stream').Stream;

var ints = new Stream(),
    sum  = ints.reduce(function(a,b) { return a + b });

sum.partition(function(n) { return n % 2 === 0 })[1].listen(console.log);

[1,2,3,4,5,6,7,8,9].forEach(ints.push, ints);

