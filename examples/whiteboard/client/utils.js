// @flow

const atMorning = (d) => {
    d.setHours(0, 0, 0, 0);
    return d;
};

export const relativeTime = (time: number) => {
    const now = Date.now();
    const thisMorning = atMorning(new Date());
    const yesterdayMorning = atMorning(new Date(thisMorning.getTime() - 3600 * 1000));
    if (time > thisMorning.getTime()) {
        return new Date(time).toLocaleTimeString();
    }
    if (time > yesterdayMorning.getTime()) {
        return 'Yesterday, ' + new Date(time).toLocaleTimeString();
    }
    return new Date(time).toLocaleDateString();
};
