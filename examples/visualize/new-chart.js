// @flow
import * as crdt from '../../packages/rich-text-crdt';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    quillDeltasToDeltas,
    deltasToQuillDeltas,
    stateToQuillContents,
    initialQuillDelta,
} from '../../packages/rich-text-crdt/quill-deltas';

const d3 = require('d3');

const nodeText = node => {
    if (node.content.type === 'text') {
        return JSON.stringify(node.content.text);
    }
    if (node.content.type === 'open') {
        return `${node.content.key}=${node.content.value}`;
    }
    if (node.content.type === 'close') {
        return `/${node.content.key}`;
    }
    return '';
};

const measureFont = font => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = font;
    return ctx.measureText('M');
};

export const createChart = () => {
    const dx = 15;
    const measure = measureFont(`${dx}px monospace`);
    const dy = dx * 3;
    const margin = { top: 10, right: 120, bottom: 10, left: 40 };

    const diagonal = d3
        .linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);

    const tree = d3.tree().nodeSize([dx, dy]);

    const svg = d3
        .create('svg')
        .attr('viewBox', [-margin.left, -margin.top, 1000, dx])
        .style('font', `${dx}px monospace`)
        .style('user-select', 'none');

    const gLink = svg
        .attr('width', 800)
        .attr('height', 200)
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

    const treeify = (data: crdt.CRDT, dx, dy) => {
        const nodes = [];
        const links = [];
        const lanes = [];
        const map = {};
        const maxDepth = node => {
            return (
                1 + (node.children ? Math.max(node.children.map(maxDepth)) : 0)
            );
        };
        // depth-first-traveral folks
        const place = (node: crdt.Node, depth: number, at: number) => {
            console.log('place', node);
            if (!lanes[depth]) {
                lanes[depth] = 0;
            }
            let x = at;
            for (let i = 0; i <= depth; i++) {
                x = Math.max(x, lanes[depth]);
            }
            // const x = Math.max(lanes[depth], at);
            const nnode = {
                id: crdt.toKey(node.id),
                x0: x * dx,
                y0: depth * dy,
                x: x * dx,
                y: depth * dy,
                data: node,
            };
            map[nnode.id] = nnode;
            nodes.push(nnode);
            lanes[depth] = x + nodeText(node).length + 2;
            for (let i = depth - 1; i >= 0; i--) {
                lanes[i] = Math.max(lanes[i], lanes[depth]);
            }
            node.children.forEach(child => {
                links.push({
                    source: nnode,
                    target: place(data.map[child], depth + 1, x),
                });
            });
            return nnode;
        };
        place(
            {
                id: [0, crdt.rootSite],
                content: { type: 'text', text: '' },
                size: 0,
                children: data.roots,
            },
            0,
            0,
        );
        return { nodes, links, map, lines: lanes };
    };

    const render = (data: crdt.CRDT) => {
        const { nodes, links, map, lines } = treeify(data, measure.width, dy);
        const rootId = `0:-root-`;

        const source_ = prevNodes;
        prevNodes = {};

        const duration = 250;

        const maxY = nodes.reduce((m, n) => Math.max(m, n.y), 0) + dy;
        const width = lines.reduce((a, b) => Math.max(a, b), 0) * dx;
        const height = maxY + margin.top + margin.bottom;

        // gLink.attr('width', width);

        const transition = svg
            .transition()
            .duration(duration)
            .attr('viewBox', [-margin.left, -margin.top, width, height])
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

        const text = id => {
            if (id === rootId) {
                return '';
            }
            const node = data.map[id];
            return nodeText(node);
            // return id === rootId ? '' : JSON.stringify(data.map[id].text);
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
            .text(d => text(d.id))
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
            .text(d => crdt.toKey(d.data.id));

        nodeEnter
            .append('text')
            .attr('dy', '2.31em')
            .attr('x', 6)
            .attr('font-size', dx * 0.7)
            .attr('text-anchor', 'start')
            .text(d => d.data.size.toString());

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
                    if (d.data.format) {
                        const format = ncrdt.value(d.data.format);
                        if (format.bold) {
                            items.push('font-weight: bold');
                        }
                        if (format.underline) {
                            items.push('text-decoration: underline');
                        }
                        if (format.italic) {
                            items.push('font-style: italic');
                        }
                    }
                    return items.join('; ');
                }
            })
            .text((d, i) => {
                if (i === 2) {
                    return crdt.toKey(d.data.id);
                }
                if (i === 3) {
                    return d.data.size;
                }
                return text(d.id);
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
