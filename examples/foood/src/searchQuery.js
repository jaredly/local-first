// @flow

export const updateSearchQuery = (currentSearch: string, value: string): string => {
    const query = new URLSearchParams(currentSearch);
    if (value) {
        query.set('q', value);
    } else {
        query.delete('q');
    }
    const search = query.toString();
    return search ? `?${search}` : '';
};
