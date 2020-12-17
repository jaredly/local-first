// @-flow

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const babel = require('@babel/core');
const { transformFromAst, transform } = babel;
const traverse = require('@babel/traverse');
const generate = require('@babel/generator');
const recast = require('recast');

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
            const newRel = path.relative(path.dirname(currentPath), full);
            return newRel.startsWith('.') ? newRel : './' + newRel;
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
            ExportNamedDeclaration(path, state) {
                if (path.node.source) {
                    const repl = checkImport(path.node.source.value);
                    if (repl) {
                        path.node.source.value = repl;
                    }
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

    const plugin = requireRewriter(path, config, addFile);
    const { code: es5 } = transform(code, {
        plugins: [plugin],
        presets: [require.resolve('@babel/preset-env'), require.resolve('@babel/preset-flow')],
    });

    const ast = recast.parse(code, {
        parser: {
            parse: code =>
                parser.parse(code, {
                    sourceType: 'module',
                    plugins: ['flow'],
                }),
        },
    });
    traverse.default(ast, plugin(babel).visitor);
    const { code: flow } = recast.print(ast);

    return { es5, flow };
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
            base = path.dirname(file);
        } else if (!file.startsWith(base)) {
            base = greatestCommonSubpath(base, file);
        }
    });
    return base;
};

const packageJsonsFor = file => {
    const found = [];
    while (file.length && file !== '/' && file !== '.') {
        file = path.dirname(file);
        const pjp = path.join(file, 'package.json');
        if (fs.existsSync(pjp)) {
            found.push(pjp);
        }
        // console.log(file);
    }
    return found;
};

const collectPackageJsons = files => {
    const all = {};
    Object.keys(files).forEach(name => {
        packageJsonsFor(name).forEach(p => (all[p] = true));
    });
    return Object.keys(all);
};

module.exports = config => {
    const files = {};
    const toProcess = [path.resolve(config.entry)];
    mkdirp(config.dest);

    while (toProcess.length) {
        const next = toProcess.shift();
        console.log('> ', next);
        files[next] = null;
        console.log(next);
        const output = processFile(next, config, fileName => {
            console.log('found require I guess', fileName);
            if (files[fileName] === undefined) {
                files[fileName] = null;
                toProcess.push(fileName);
            }
        });
        files[next] = output;
    }
    console.log(Object.keys(files));
    const base = basePath(Object.keys(files));
    console.log('base', base);

    const packageJsons = collectPackageJsons(files);
    const main = packageJsonsFor(config.entry)[0];
    const packageJson = require(path.resolve(main));
    if (!packageJson.dependencies) {
        packageJson.dependencies = {};
    }
    packageJsons.forEach(cpath => {
        if (cpath !== main) {
            const data = require(path.resolve(cpath));
            console.log('processing extra package.json', cpath); //, Object.keys(data.dependencies))
            if (data.dependencies) {
                Object.keys(data.dependencies).forEach(k => {
                    if (
                        packageJson.dependencies[k] &&
                        packageJson.dependencies[k] !== data.dependencies[k]
                    ) {
                        throw new Error(
                            `Incompatible dependency: ${data.dependencies[k]} (from ${cpath}) vs ${packageJson.dependencies[k]}`,
                        );
                    }
                    packageJson.dependencies[k] = data.dependencies[k];
                });
            }
        }
    });

    // Clear out devDependencies
    packageJson.devDependencies = {};

    Object.keys(files).forEach(file => {
        const rel = path.relative(base, file);
        const full = path.join(config.dest, rel);
        mkdirp(path.dirname(full));
        console.log('Writing', file, rel, full);
        fs.writeFileSync(full, files[file].es5, 'utf8');
        fs.writeFileSync(full + '.flow', files[file].flow, 'utf8');
    });
    packageJson.main = path.relative(base, config.entry);
    if (config.start) {
        packageJson.scripts = {
            ...packageJson.scripts,
            start: `node ${packageJson.main}`,
        };
    }
    fs.writeFileSync(
        path.join(config.dest, 'package.json'),
        JSON.stringify(packageJson, null, 2),
        'utf8',
    );
};
