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

const mergeFormats = (one, two) => ncrdt.merge(one, two);

const initQuill = (div, render) => {
    const ui = new Quill(div, { theme: 'snow' });
    const name = 'a';
    let clock = hlc.init(name, Date.now());
    const state = crdt.init(name);
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
            const changes = deltaToChange(state, delta, quillFormat => {
                return ncrdt.createValue(quillFormat, getStamp());
            });
            changes.forEach(change => {
                crdt.apply(state, change, mergeFormats);
            });
            render(state);
        },
    );
    render(state);
    return div;
};

const createChart = data => {
    const width = 1500;

    const dx = 20;
    const dy = width / 20;
    const margin = { top: 10, right: 120, bottom: 10, left: 40 };

    const diagonal = d3
        .linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    const tree = d3.tree().nodeSize([dx, dy]);

    const svg = d3
        .create('svg')
        .attr('viewBox', [-margin.left, -margin.top, width, dx])
        .style('font', `${dx}px sans-serif`)
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

    const treeify = data => {
        const lanes = [];
        const maxDepth = node => {
            return (
                1 + (node.children ? Math.max(node.children.map(maxDepth)) : 0)
            );
        };
        // depth-first-traveral folks
        const place = (node, depth, at) => {
            if (!lanes[depth]) {
                lanes[depth] = 0;
            }
            node.x = Math.max(lanes[depth], at);
            node.y = depth;
            lanes[depth] = node.x + node.text.length + 2;
            node.children.forEach(child => {
                place(child, depth + 1, node.x);
            });
        };
        place(data, 0, 0);
    };

    const render = data => {
        const root = d3.hierarchy({
            id: [0, '-root-'],
            children: data.roots,
            text: '',
        });

        const source_ = prevNodes;
        prevNodes = {};

        root.x0 = dy / 2;
        root.y0 = 0;
        root.descendants().forEach(d => {
            d.id = crdt.toKey(d.data.id);
        });

        const duration = 250;
        const nodes = root.descendants().reverse();
        const links = root.links();

        // Compute the new tree layout.
        tree(root);
        window.root = root;

        let left = root;
        let right = root;
        root.eachBefore(node => {
            if (prevNodes) {
                prevNodes[node.id] = node;
            }
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

        const source = d => ({ x0: 0, y0: 0, x: 0, y: 0 });

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node
            .enter()
            .append('g')
            .attr(
                'transform',
                d => `translate(${source(d).y0},${source(d).x0})`,
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
            .attr('x', d => (d.children ? -6 : 6))
            .attr('text-anchor', d => (d.children ? 'end' : 'start'))
            .text(d => crdt.toKey(d.data.id) + ' ' + d.data.text)
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
            .text(d => crdt.toKey(d.data.id) + ' ' + d.data.text)
            .attr('x', d => (d.children ? -6 : 6))
            .attr('text-anchor', d => (d.children ? 'end' : 'start'));

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node
            .exit()
            .transition(transition)
            .remove()
            .attr('transform', d => `translate(${source(d).y},${source(d).x})`)
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
            .remove()
            .attr('d', d => {
                const o = {
                    x: d.source.x,
                    y: d.source.y,
                };
                return diagonal({ source: o, target: o });
            });

        // Stash the old positions for transition.
        root.eachBefore(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
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
        .style('font', `${dx}px sans-serif`)
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
