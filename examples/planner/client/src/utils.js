// @flow

export const interleave = function <T>(items: Array<T>, fn: (number) => T): Array<T> {
    const res = [];
    items.forEach((item, i) => {
        if (i > 0) {
            res.push(fn(i));
        }
        res.push(item);
    });
    return res;
};

export const sameDay = (one: Date, two: Date) => {
    return (
        one.getFullYear() === two.getFullYear() &&
        one.getMonth() === two.getMonth() &&
        one.getDate() === two.getDate()
    );
};

export const isToday = (date: Date) => {
    return sameDay(date, today());
};

export const today = () => {
    const now = new Date();
    // start of day
    now.setHours(0, 0, 0, 0);
    return now;
};

export const nextDay = (date: Date) => {
    const next = new Date(date.getTime() + 36 * 3600 * 1000);
    next.setHours(0, 0, 0, 0);
    return next;
};

export const prevDay = (date: Date) => {
    const prev = new Date(date.getTime() - 12 * 3600 * 1000);
    prev.setHours(0, 0, 0, 0);
    return prev;
};

export const tomorrow = () => {
    return nextDay(today());
};

export const showDate = (date: Date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

export const parseDate = (text: string) => {
    const [year, month, date] = text.split('-');
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setFullYear(+year);
    d.setMonth(+month - 1);
    d.setDate(+date);
    return d;
};
