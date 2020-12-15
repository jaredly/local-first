// @flow
import * as React from 'react';

const expandKey = (id) => `expanded:${id}`;

const loadJson = (id) => {
    const raw = localStorage.getItem(id);
    if (raw != null) {
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.log('failed to load ', id, 'from local storage');
            console.log(err);
            return;
        }
    } else {
        return;
    }
};

const saveJson = (id, value) => (localStorage[id] = JSON.stringify(value));

export type Node = { focus: () => void };

export const useExpanded = (local: LocalClient, id: string) => {
    const [expanded, setExpanded] = React.useState(local.isExpanded(id));
    React.useEffect(() => {
        return local.listen(id, (expanded) => setExpanded(expanded));
    });
    return expanded;
};

export default class LocalClient {
    expanded: { [key: string]: boolean } = {};
    refs: { [key: string]: React.ElementRef<*> } = {};
    focusNext: ?string = null;
    id: string;
    _saveTimeout: ?TimeoutID;
    _listeners: { [key: string]: Array<(boolean) => void> };

    constructor(id: string) {
        this.id = id;
        this.expanded = loadJson(expandKey(id)) || {};
        this._listeners = {};
    }

    teardown() {
        localStorage.removeItem(expandKey(this.id));
    }

    listen(id: string, fn: (boolean) => void): () => void {
        // const listener =
        if (!this._listeners[id]) {
            this._listeners[id] = [fn];
        } else {
            this._listeners[id].push(fn);
        }
        return () => {
            this._listeners[id] = this._listeners[id].filter((f) => f !== fn);
        };
    }

    setFocus(id: ?string) {
        if (id == null) {
            return;
        }
        if (this.refs[id]) {
            this.refs[id].focus();
        } else {
            this.focusNext = id;
        }
    }

    isExpanded(id: string) {
        return !!this.expanded[id];
    }

    setExpanded(id: string, expanded: boolean) {
        if (this.expanded[id] == expanded) {
            return;
        }
        this.expanded[id] = expanded;
        if (this._listeners[id]) {
            this._listeners[id].forEach((f) => f(expanded));
        }
        this.save();
    }

    save() {
        if (!this._saveTimeout) {
            this._saveTimeout = setTimeout(() => {
                this._saveTimeout = null;
                this._save();
            }, 10);
        }
    }

    _save = () => {
        saveJson(expandKey(this.id), this.expanded);
    };

    register(id: string, node: ?Node) {
        if (!node) {
            delete this.refs[id];
            return;
        }
        this.refs[id] = node;
        if (this.focusNext === id) {
            // console.log('found', id, 'and focusing');
            node.focus();
            this.focusNext = null;
        }
    }
}
