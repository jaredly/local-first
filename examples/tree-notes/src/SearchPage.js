// @flow
import * as React from 'react';
import { Jump } from './JumpDialog';

const Search = ({ client, url }: *) => {
    return <Jump client={client} url={url} onClose={() => {}} />;
};

export default Search;
