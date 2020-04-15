// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { makeStyles } from '@material-ui/core/styles';

import OpenGraph from './OpenGraph';

import type { LinkT } from './types';

// TODO: hide if not completed.
const LinkItem = ({ link }: { link: LinkT }) => {
    if (link.fetchedContent) {
        return <OpenGraph data={link.fetchedContent} url={link.url} />;
    }
    return (
        <div>
            <a href={link.url} target="_blank">
                {link.url}
            </a>
        </div>
    );
};

export default LinkItem;
