const fuzzyScore = (exactWeight, query, term) => {
    if (query.length === 0) {
        return {
            loc: -1,
            score: 0,
            full: true,
            exact: false,
            breaks: 0,
            breakSize: 0,
            len: term.length,
        };
    }
    query = query.toLowerCase();
    term = term.toLowerCase();
    if (query === term) {
        return {
            loc: 0,
            score: exactWeight,
            full: true,
            exact: true,
            breaks: 0,
            breakSize: 0,
            len: term.length,
        };
    }
    if (term.indexOf(query) !== -1) {
        return {
            loc: term.indexOf(query),
            score: exactWeight,
            exact: false,
            full: true,
            breaks: 0,
            breakSize: 0,
            len: term.length,
        };
    }
    let qi = 0,
        ti = 0,
        score = 0,
        loc = -1,
        matchedLast = true,
        breaks = 0,
        breakSize = 0;
    for (; qi < query.length && ti < term.length; ) {
        if (query[qi] === term[ti]) {
            score = score + (matchedLast ? 3 : 1);
            loc = qi === 0 ? ti : loc;
            qi++;
            matchedLast = true;
        } else {
            if (matchedLast && loc !== -1) {
                breaks += 1;
            }
            if (loc !== -1) {
                breakSize += 1;
            }
            matchedLast = false;
        }
        ti++;
    }
    return {
        loc,
        score,
        full: ti >= term.length,
        exact: false,
        breaks,
        breakSize,
        len: term.length,
    };
};

const fuzzysearch = (needle, haystack) => {
    if (needle.length > haystack.length) {
        return false;
    }
    if (needle.length === haystack.length) {
        return needle === haystack;
    }
    if (needle.length === 0) {
        return true;
    }
    for (let i = 0, j = 0; i < needle.length && j < haystack.length; ) {
        if (needle[i] === haystack[j]) {
            i++;
        }
        j++;
    }
    return false;
};
