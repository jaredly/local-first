// @flow
// Takes care of aliasing packages in `shared` so that we don't end up with
// duplicate copies of 'react'
const fs = require('fs');
const path = require('path');

const getImports = (text) => {
    const imports = {};
    text.replace(/\bfrom '([^']+)';\n/g, (_, path) => {
        if (path.startsWith('.')) {
            return;
        }
        imports[path] = true;
    });
    return imports;
};

const getAllImports = (base) => {
    const allImports = {};
    fs.readdirSync(base).forEach((name) => {
        if (!name.endsWith('.js')) {
            return;
        }
        const full = path.join(base, name);
        const text = fs.readFileSync(full, 'utf8');
        const imports = getImports(text);
        Object.assign(allImports, imports);
    });
    return Object.keys(allImports).sort();
};

const updatePackageJson = (filePath, imports) => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // NOTE: we're only adding, we don't remove.
    imports.forEach((name) => (data.alias[name] = `./node_modules/${name}`));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
};

const updateFlowConfig = (filePath, imports) => {};

const base = path.join(__dirname, '..', 'shared');
const imports = getAllImports(base);
updatePackageJson(path.join(__dirname, 'package.json'), imports);
