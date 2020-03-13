// @flow
const d3 = require('d3');

const measureFont = font => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = font;
    return ctx.measureText('M');
};

type YNode = {
    id: { client: number, clock: number },
    origin: ?{ client: number, clock: number },
    content:
        | {| str: string |}
        | {| key: string, value: ?any |}
        | {| len: number |},
    countable: boolean,
    length: number,
    deleted: boolean,
    left: ?YNode,
    right: ?YNode,
};

const nodeText = (node: YNode) => {
    if (node.content.str) {
        return JSON.stringify(node.content.str);
    }
    if (node.content.key) {
        if (node.content.value) {
            return `${node.content.key}=${node.content.value}`;
        }
        return `/${node.content.value}`;
    }
    // if (node.content.key === 'bold') {
    //     return 'B';
    // }
    // if (node.content.key === 'italic') {
    //     return 'I';
    // }
    // if (node.content.key === 'underline') {
    //     return 'U';
    // }
    // if (node.content.key) {
    //     return (node.content.value ? '' : '/') + node.content.key;
    // }
    if (node.content.len) {
        return node.content.len.toString();
    }
    return JSON.stringify(node.content);
};

export const createYChart = () => {
    const dx = 15;
    const measure = measureFont(`${dx}px monospace`);
    const dy = dx * 3;
    const margin = { top: 10, right: 120, bottom: 10, left: 40 };

    const diagonal = d3
        .linkRadial()
        .angle(d => d.x)
        .radius(d => d.y);

    // const tree = d3.tree().nodeSize([dx, dy]);

    const svg = d3
        .create('svg')
        .attr('viewBox', [-margin.left, -margin.top, 1000, dx])
        .style('font', `${dx}px monospace`)
        .style('user-select', 'none');

    const gLink = svg
        .attr('width', 800)
        .attr('height', 100)
        .append('g')
        .attr('fill', 'none')
        .attr('stroke', '#555')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.5);

    const gNode = svg
        .append('g')
        .attr('cursor', 'pointer')
        .attr('pointer-events', 'all');

    let prevNodes = null;

    const toKey = (id: { client: number, clock: number }) =>
        `${id.clock}:${id.client}`;

    const process = (data: Array<YNode>, dx, dy) => {
        const nodes = [];
        const links = [];
        const map = {};
        let x = 0;
        data.forEach(data => {
            const node = {
                id: toKey(data.id),
                x0: x * dx,
                y0: 0,
                x: x * dx,
                y: 0,
                data,
            };
            let ln = nodeText(data).length;
            x += ln + 2;
            map[node.id] = node;
            nodes.push(node);
            if (data.origin) {
                const target = map[toKey(data.origin)];
                if (!target) {
                    console.log('No target!');
                    console.log(data.origin);
                    console.log(map);
                } else {
                    links.push({
                        source: node,
                        target: target,
                    });
                }
            }
        });
        return { nodes, links, map, width: x * dx };
    };

    type YDoc = {
        _start: YNode,
    };

    const collectNodes = (data: YDoc) => {
        const items = [];
        let current = data._start;
        while (current) {
            items.push(current);
            current = current.right;
        }
        return items;
    };

    const render = (data: YDoc) => {
        const ynodes = collectNodes(data);
        const { nodes, links, map, width } = process(ynodes, measure.width, dy);

        const source_ = prevNodes;
        prevNodes = {};

        const duration = 250;

        const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0) + dy;
        const height = maxY + margin.top + margin.bottom;

        gLink.attr('width', width);

        const transition = svg
            .transition()
            .duration(duration)
            .attr('viewBox', [
                -margin.left,
                -margin.top,
                width + margin.right + margin.left,
                height,
            ])
            .tween(
                'resize',
                window.ResizeObserver
                    ? null
                    : () => () => svg.dispatch('toggle'),
            );

        // Update the nodes…
        const node = gNode.selectAll('g').data(nodes, d => d.id);

        const source = d => {
            if (map[d.data.parent]) {
                return map[d.data.parent];
            }
            return { x: 0, y: 0, x0: 0, y0: 0 };
        };

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node
            .enter()
            .append('g')
            .attr(
                'transform',
                d => `translate(${source(d).x0},${source(d).y0})`,
            )
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0);

        nodeEnter
            .append('circle')
            .attr('r', dx / 4)
            .attr('fill', d => (d.children ? '#555' : '#999'))
            .attr('stroke-width', 1);

        nodeEnter
            .append('text')
            .attr('dy', '0.31em')
            .attr('x', 6)
            .attr('text-anchor', 'start')
            .text(d => nodeText(d.data))
            .clone(true)
            .lower()
            .attr('stroke-linejoin', 'round')
            .attr('stroke-width', 3)
            .attr('stroke', 'white');

        nodeEnter
            .append('text')
            .attr('dy', '1.31em')
            .attr('x', 6)
            .attr('font-size', dx * 0.7)
            .attr('text-anchor', 'start')
            .text(d => toKey(d.data.id));

        nodeEnter
            .append('text')
            .attr('dy', '2.31em')
            .attr('x', 6)
            .attr('font-size', dx * 0.7)
            .attr('text-anchor', 'start')
            .text(d => d.data.length.toString());

        // Transition nodes to their new position.
        const nodeUpdate = node
            .merge(nodeEnter)
            .transition(transition)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .attr('fill-opacity', d => (d.data.deleted ? 0.5 : 1))
            .attr('stroke-opacity', 1);
        nodeUpdate
            .selectAll('text')
            .attr('style', (d, i) => {
                if (i < 2) {
                    if (d.data.deleted) {
                        return 'text-decoration: line-through';
                    }
                    const items = [];
                    if (d.data.content.key === 'bold') {
                        items.push('font-weight: bold');
                    }
                    if (d.data.content.key === 'underline') {
                        items.push('text-decoration: underline');
                    }
                    if (d.data.content.key === 'italic') {
                        items.push('font-style: italic');
                    }
                    // if (d.data.format) {
                    //     const format = ncrdt.value(d.data.format);
                    //     if (format.bold) {
                    //         items.push('font-weight: bold');
                    //     }
                    //     if (format.underline) {
                    //         items.push('text-decoration: underline');
                    //     }
                    //     if (format.italic) {
                    //         items.push('font-style: italic');
                    //     }
                    // }
                    return items.join('; ');
                }
            })
            .text((d, i) => {
                if (i === 2) {
                    return toKey(d.data.id);
                }
                if (i === 3) {
                    return d.data.length;
                }
                return nodeText(d.data);
            });

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node
            .exit()
            .transition(transition)
            .remove()
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0);

        // Update the links…
        const link = gLink.selectAll('path').data(links, d => d.target.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link
            .enter()
            .append('path')
            .attr('d', d => {
                const o = {
                    x: d.source.x0,
                    y: d.source.y0,
                };
                return diagonal({ source: o, target: o });
            });

        // Transition links to their new position.
        link.merge(linkEnter)
            .transition(transition)
            .attr('d', diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit()
            .transition(transition)
            .remove();
    };

    return { node: svg.node(), render };
};
