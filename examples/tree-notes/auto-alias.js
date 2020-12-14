// @flow
// Takes care of aliasing packages in `shared` so that we don't end up with
// duplicate copies of 'react'
const fs = require('fs');
const path = require('path');

const getImports = (text) => {
    const imports = {};
    text.replace(/\bfrom '([^']+)';\n/g, (_, path) => {
        if (path.startsWith('.')) {
            return '';
        }
        imports[path] = true;
        return '';
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

const parseFlowConfig = (lines) => {
    const sections = [];
    lines.forEach((line) => {
        if (line.match(/^\[.*\]$/)) {
            sections.push([line]);
            console.log(line);
        } else if (sections.length) {
            if (!line.trim() && sections[sections.length - 1].length === 1) {
                // skip blanks right after header
                return;
            }
            sections[sections.length - 1].push(line);
        }
    });

    return sections;
};

const updateFlowConfig = (filePath, imports) => {
    let sections = parseFlowConfig(fs.readFileSync(filePath, 'utf8').split('\n'));
    sections = sections.map((section) => {
        if (section[0].trim() !== '[options]') {
            return section;
        }
        const newSection = [];
        // const mappers = {}
        section.forEach((line) => {
            if (!line.startsWith(`module.name_mapper=`)) {
                return newSection.push(line);
            }
            // mappers.push(line)
        });
        imports.forEach((name) => {
            newSection.push(
                `module.name_mapper='${name}' -> '<PROJECT_ROOT>/node_modules/${name}'`,
            );
        });
        return newSection;
    });
    const newText = sections.map((section) => section.join('\n').trim()).join('\n\n');
    fs.writeFileSync(filePath, newText, 'utf8');
};

const base = path.join(__dirname, '..', 'shared');
const imports = getAllImports(base);
updatePackageJson(path.join(__dirname, 'package.json'), imports);
updateFlowConfig(path.join(__dirname, '.flowconfig'), imports);
