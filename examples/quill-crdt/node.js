export const node = (tag, attrs, children) => {
    const node = document.createElement(tag);
    if (attrs) {
        Object.keys(attrs).forEach(attr => {
            if (attr === 'style') {
                Object.assign(node.style, attrs[attr]);
            } else if (typeof attrs[attr] === 'function') {
                // $FlowFixMe
                node[attr] = attrs[attr];
            } else {
                node.setAttribute(attr, attrs[attr]);
            }
        });
    }
    if (children) {
        const add = child => {
            if (Array.isArray(child)) {
                child.forEach(add);
            } else if (typeof child === 'string' || typeof child === 'number') {
                node.appendChild(document.createTextNode(child.toString()));
            } else if (child) {
                node.appendChild(child);
            }
        };
        add(children);
    }
    return node;
};
export const div = (attrs, children) => node('div', attrs, children);
export const span = (attrs, children) => node('span', attrs, children);

export const addDiv = (attrs, children) => {
    const node = div(attrs, children);
    // $FlowFixMe
    document.body.appendChild(node);
    return node;
};
