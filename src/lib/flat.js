module.exports.flatten = (arr) => arr.reduce((acc, val) => acc.concat(val), []);
module.exports.flatMap = (arr, cb) => module.exports.flatten(arr.map(cb));
