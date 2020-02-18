// @flow
import * as hlc from '../../../packages/hybrid-logical-clock';
import type { HLC } from '../../../packages/hybrid-logical-clock';

export const localStorageClockPersist = (key: string) => ({
    get(init: () => HLC): HLC {
        const raw = localStorage.getItem(key);
        if (!raw) {
            const res = init();
            localStorage.setItem(key, hlc.pack(res));
            return res;
        }
        return hlc.unpack(raw);
    },
    set(clock: HLC) {
        localStorage.setItem(key, hlc.pack(clock));
    },
});

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

type ClockPersist = { get: (() => HLC) => HLC, set: HLC => void };

export class PersistentClock {
    persist: ClockPersist;
    now: HLC;
    constructor(persist: ClockPersist) {
        this.persist = persist;
        this.now = persist.get(() => hlc.init(genId(), Date.now()));
        // $FlowFixMe
        this.get = this.get.bind(this);
        // $FlowFixMe
        this.set = this.set.bind(this);
        // $FlowFixMe
        this.recv = this.recv.bind(this);
    }

    get() {
        this.now = hlc.inc(this.now, Date.now());
        this.persist.set(this.now);
        return hlc.pack(this.now);
    }

    set(newClock: HLC) {
        this.now = newClock;
        this.persist.set(this.now);
    }

    recv(newClock: HLC) {
        this.now = hlc.recv(this.now, newClock, Date.now());
        this.persist.set(this.now);
    }
}
