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

export default class LocalClient {
    expanded: { [key: string]: boolean } = {};
    refs: { [key: string]: React.ElementRef<*> } = {};
    focusNext: ?string = null;
    id: string;
    _saveTimeout: ?TimeoutID;

    constructor(id: string) {
        this.id = id;
        this.expanded = loadJson(expandKey(id)) || {};
    }

    setFocus(id: string) {
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
        this.expanded[id] = expanded;
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
            node.focus();
            this.focusNext = null;
        }
    }
}
