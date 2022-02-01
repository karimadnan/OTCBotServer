const DB = require('../Mongo');

const emoji = (script) => {
    let output;
    scripts.map(s => {
        if (script == s.script) {
            output = `${s.emoji}`
        }
    })
    return output
};


module.exports = {
    emoji
};
