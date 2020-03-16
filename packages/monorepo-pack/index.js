// @-flow

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const { transformFromAst, transform } = require('@babel/core');
const traverse = require('@babel/traverse');
const generate = require('@babel/generator');

const asExternal = (config, full) => {
    return null; // no external support yet
};

const requireRewriter = (currentPath, config, onInternalFile) => babel => {
    const { types: t } = babel;

    const checkImport = name => {
        if (name.startsWith('.')) {
            const preres = path.resolve(path.dirname(currentPath), name);
            const full = require.resolve(preres);
            const ext = asExternal(config, full);
            if (ext) {
                return ext;
            }
            onInternalFile(full);
            if (full.length > preres.length) {
                const diff = path.relative(preres, full);
                // console.log('>>>', diff);
                const newRel = path.join(name, diff);
                // console.log('<<<', name, newRel);
                return newRel.startsWith('.') ? newRel : './' + newRel;
            }
            // TODO if there's a
        }
    };

    return {
        name: 'relative-absolute', // not required
        visitor: {
            ImportDeclaration(path, state) {
                const repl = checkImport(path.node.source.value);
                if (repl) {
                    path.node.source.value = repl;
                }
            },
            CallExpression(path, state) {
                if (
                    path.node.callee.type === 'Identifier' &&
                    path.node.callee.name === 'require' &&
                    path.node.arguments.length === 1 &&
                    path.node.arguments[0].type === 'StringLiteral'
                ) {
                    const repl = checkImport(path.node.arguments[0].value);
                    if (repl) {
                        path.node.arguments[0].value = repl;
                    }
                }
            },
        },
    };
};

const processFile = (path, config, addFile) => {
    const code = fs.readFileSync(path, 'utf8');

    // TODO translate the paths
    const res = transform(code, {
        plugins: [requireRewriter(path, config, addFile)],
        presets: [
            require.resolve('@babel/preset-env'),
            require.resolve('@babel/preset-flow'),
        ],
    });

    return res.code;
};

const mkdirp = dir => {
    if (fs.existsSync(dir)) {
        return;
    }
    mkdirp(path.dirname(dir));
    fs.mkdirSync(dir);
};

const greatestCommonSubpath = (path1, path2) => {
    const rel = path.relative(path1, path2);
    const parts = path1.split(path.sep);
    const relparts = rel.split(path.sep);
    let i = 0;
    for (; i < relparts.length; i++) {
        if (relparts[i] !== '..') {
            break;
        }
    }
    return parts.slice(0, parts.length - i).join(path.sep);
};

const basePath = files => {
    let base = null;
    files.forEach(file => {
        if (base === null) {
            base = file;
        } else if (!file.startsWith(base)) {
            base = greatestCommonSubpath(base, file);
        }
    });
    return base;
};

module.exports = config => {
    const files = {};
    const packageJsons = {};
    const toProcess = [path.resolve(config.entry)];
    mkdirp(config.dest);

    while (toProcess.length) {
        const next = toProcess.shift();
        files[next] = null;
        console.log(next);
        const output = processFile(next, config, fileName => {
            if (files[fileName] === undefined) {
                files[fileName] = null;
                toProcess.push(fileName);
            }
        });
        files[next] = output;
    }
    console.log(Object.keys(files));
    const base = basePath(Object.keys(files));
    console.log(base);
    Object.keys(files).forEach(file => {
        const rel = path.relative(base, file);
        const full = path.join(config.dest, rel);
        mkdirp(path.dirname(full));
        fs.writeFileSync(full, files[file], 'utf8');
    });
};
