// @flow
import Quill from 'quill';
import * as crdt from '../../packages/text-crdt/tree';
import * as ncrdt from '../../packages/nested-object-crdt';
import * as debug from '../../packages/text-crdt/debug';
import * as hlc from '../../packages/hybrid-logical-clock';
import {
    deltaToChange,
    changeToDelta,
    type QuillDelta,
} from '../../packages/text-crdt/quill-deltas';
const d3 = require('d3');
const _data = require('./flare.js');

type QuillFormat = {
    bold?: boolean,
    underline?: boolean,
    italic?: boolean,
};
type Format = ncrdt.MapCRDT;

const mergeFormats = (one: Format, two: Format) => ncrdt.merge(one, two);

const initialDelta = {
    type: 'insert',
    span: {
        id: [0, '-initial-'],
        after: [0, crdt.rootSite],
        text: 'Hello world! we did it.\n',
        // text: '\n',
    },
};

const initQuill = (div, render: (crdt.CRDT<Format>) => void) => {
    const ui = new Quill(div, { theme: 'snow' });
    const name = 'a';
    let clock = hlc.init(name, Date.now());
    const state: crdt.CRDT<Format> = crdt.init(name);
    crdt.apply(state, initialDelta, mergeFormats);
    ui.setText(crdt.toString(state));

    const getStamp = () => {
        const next = hlc.inc(clock, Date.now());
        clock = next;
        return hlc.pack(next);
    };
    const recvStamp = stamp => {
        const next = hlc.recv(clock, hlc.unpack(stamp), Date.now());
        clock = next;
    };

    ui.on(
        'text-change',
        (delta: Array<QuillDelta<QuillFormat>>, oldDelta, source: string) => {
            if (source === 'crdt') {
                return;
            }
            const changes = deltaToChange<QuillFormat, Format>(
                state,
                delta,
                quillFormat => {
                    return ncrdt.createDeepMap(quillFormat, getStamp());
                },
            );
            // console.log('delta', delta);
            // console.log(changes);
            changes.forEach(change => {
                crdt.apply(state, change, mergeFormats);
            });
            render(state);
        },
    );
    render(state);
    return div;
};

const measureFont = font => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = font;
    return ctx.measureText('M');
};

const createChart = data => {
    const width = 1500;

    const dx = 20;
    const measure = measureFont(`${dx}px monospace`);
    console.log(measure);
    const dy = width / 20;
    const margin = { top: 10, right: 120, bottom: 10, left: 40 };

    const diagonal = d3
        .linkHorizontal()
        .x(d => d.x)
        .y(d => d.y);

    const tree = d3.tree().nodeSize([dx, dy]);

    const svg = d3
        .create('svg')
        .attr('viewBox', [-margin.left, -margin.top, width, dx])
        .style('font', `${dx}px monospace`)
        .style('user-select', 'none');

    const gLink = svg
        .attr('width', width)
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

    const treeify = (data: crdt.Node<ncrdt.MapCRDT>, dx, dy) => {
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
        const place = (node: crdt.Node<Format>, depth: number, at: number) => {
            if (!lanes[depth]) {
                lanes[depth] = 0;
            }
            const x = Math.max(lanes[depth], at);
            const nnode = {
                id: crdt.toKey(node.id),
                x0: x * dx,
                y0: depth * dy,
                x: x * dx,
                y: depth * dy,
                data: node,
            };
            map[nnode.id] = nnode;
            // console.log(nnode);
            // if (isNaN(x)) {
            //     console.log(lanes, lanes[depth], depth, at);
            // }
            nodes.push(nnode);
            lanes[depth] = x + node.text.length + 2;
            node.children.forEach(child => {
                links.push({
                    source: nnode,
                    target: place(child, depth + 1, x),
                });
            });
            return nnode;
        };
        place(data, 0, 0);
        return { nodes, links, map };
    };

    const render = (data: crdt.CRDT<Format>) => {
        // const root = d3.hierarchy({
        //     id: [0, '-root-'],
        //     children: data.roots,
        //     text: '',
        // });
        const { nodes, links, map } = treeify(
            {
                id: [0, '-root-'],
                parent: '',
                size: 0,
                children: data.roots,
                text: '',
            },
            measure.width,
            dy,
        );

        const source_ = prevNodes;
        prevNodes = {};

        // root.x0 = dy / 2;
        // root.y0 = 0;
        // root.descendants().forEach(d => {
        //     d.id = crdt.toKey(d.data.id);
        // });

        const duration = 250;
        // const nodes = root.descendants().reverse();
        // const links = root.links();

        // Compute the new tree layout.
        // tree(root);
        // window.root = root;

        // let left = root;
        // let right = root;
        // root.eachBefore(node => {
        //     if (prevNodes) {
        //         prevNodes[node.id] = node;
        //     }
        //     if (node.x < left.x) left = node;
        //     if (node.x > right.x) right = node;
        // });
        const height = 1000;

        // const height = right.x - left.x + margin.top + margin.bottom;

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
            .text(d => d.data.text)
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
                return d.data.text;
            });

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node
            .exit()
            .transition(transition)
            .remove()
            // .attr('transform', d => `translate(${source(d).x},${source(d).y})`)
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
        // .attr('d', d => {
        //     const o = {
        //         x: d.source.x,
        //         y: d.source.y,
        //     };
        //     return diagonal({ source: o, target: o });
        // });

        // Stash the old positions for transition.
        // root.eachBefore(d => {
        //     d.x0 = d.x;
        //     d.y0 = d.y;
        // });
    };

    return { node: svg.node(), render };
};

const init = data => {
    const width = 1500;

    const dx = 20;
    const dy = width / 6;
    const margin = { top: 10, right: 120, bottom: 10, left: 40 };

    const diagonal = d3
        .linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    const tree = d3.tree().nodeSize([dx, dy]);

    const root = d3.hierarchy(data);

    root.x0 = dy / 2;
    root.y0 = 0;
    root.descendants().forEach((d, i) => {
        d.id = i;
        d._children = d.children;
        if (d.depth && d.data.name.length !== 7) d.children = null;
    });

    const svg = d3
        .create('svg')
        .attr('viewBox', [-margin.left, -margin.top, width, dx])
        .style('font', `${dx}px monospace`)
        .style('user-select', 'none');

    const gLink = svg
        .attr('width', width)
        .append('g')
        .attr('fill', 'none')
        .attr('stroke', '#555')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.5);

    const gNode = svg
        .append('g')
        .attr('cursor', 'pointer')
        .attr('pointer-events', 'all');

    function update(source) {
        const duration = 250;
        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout.
        tree(root);

        let left = root;
        let right = root;
        root.eachBefore(node => {
            if (node.x < left.x) left = node;
            if (node.x > right.x) right = node;
        });

        const height = right.x - left.x + margin.top + margin.bottom;

        const transition = svg
            .transition()
            .duration(duration)
            .attr('viewBox', [-margin.left, left.x - margin.top, width, height])
            .tween(
                'resize',
                window.ResizeObserver
                    ? null
                    : () => () => svg.dispatch('toggle'),
            );

        // Update the nodes…
        const node = gNode.selectAll('g').data(nodes, d => d.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node
            .enter()
            .append('g')
            .attr('transform', d => `translate(${source.y0},${source.x0})`)
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0)
            .on('click', d => {
                d.children = d.children ? null : d._children;
                update(d);
            });

        nodeEnter
            .append('circle')
            .attr('r', dx / 4)
            .attr('fill', d => (d._children ? '#555' : '#999'))
            .attr('stroke-width', 1);

        nodeEnter
            .append('text')
            .attr('dy', '0.31em')
            .attr('x', d => (d.children ? -6 : 6))
            .attr('text-anchor', d => (d.children ? 'end' : 'start'))
            .text(d => d.data.name)
            .clone(true)
            .lower()
            .attr('stroke-linejoin', 'round')
            .attr('stroke-width', 3)
            .attr('stroke', 'white');

        // Transition nodes to their new position.
        const nodeUpdate = node
            .merge(nodeEnter)
            .transition(transition)
            .attr('transform', d => `translate(${d.y},${d.x})`)
            .attr('fill-opacity', 1)
            .attr('stroke-opacity', 1);
        nodeUpdate
            .selectAll('text')
            .attr('x', d => (d.children ? -6 : 6))
            .attr('text-anchor', d => (d.children ? 'end' : 'start'));

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node
            .exit()
            .transition(transition)
            .remove()
            .attr('transform', d => `translate(${source.y},${source.x})`)
            .attr('fill-opacity', 0)
            .attr('stroke-opacity', 0);

        // Update the links…
        const link = gLink.selectAll('path').data(links, d => d.target.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link
            .enter()
            .append('path')
            .attr('d', d => {
                const o = { x: source.x0, y: source.y0 };
                return diagonal({ source: o, target: o });
            });

        // Transition links to their new position.
        link.merge(linkEnter)
            .transition(transition)
            .attr('d', diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit()
            .transition(transition)
            .remove()
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return diagonal({ source: o, target: o });
            });

        // Stash the old positions for transition.
        root.eachBefore(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
    update(root);
    return svg.node();
};

if (document.body) {
    const body = document.body;
    const div = document.createElement('div');
    body.appendChild(div);

    const chart = createChart(_data);

    const quill = initQuill(div, chart.render);
    // const chart = init(_data);
    body.appendChild(chart.node);
}
