// @-flow

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { transformFromAst, transform } = require('@babel/core');
const traverse = require('@babel/traverse');
const generate = require('@babel/generator');

const processFile = path => {
    const code = fs.readFileSync(path, 'utf8');
    // const ast = parser.parse(code, {
    //     sourceType: 'module',
    //     plugins: ['flow', 'exportDefaultFrom'],
    // });
    // const newAst = transformFromAst(ast, {
    //     babelrc: true,
    //     presets: [
    //         require.resolve('@babel/preset-flow'),
    //         require.resolve('@babel/preset-env'),
    //     ],
    // });

    // console.log(newAst);
    // return newAst.code;
    const res = transform(code, {
        // sourceType: 'module',
        // plugins: ['flow', 'exportDefaultFrom'],
        // babelrc: true,
        presets: [
            require.resolve('@babel/preset-flow'),
            require.resolve('@babel/preset-env'),
        ],
    });
    // console.log(res);
    return res.code;
};

module.exports = config => {
    const output = processFile(path.resolve(config.entry));
    fs.writeFileSync('./ok.js', output, 'utf8');
};
