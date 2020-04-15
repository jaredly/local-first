// @flow
import * as React from 'react';

import Container from '@material-ui/core/Container';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import { makeStyles } from '@material-ui/core/styles';

import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import CheckBoxIcon from '@material-ui/icons/CheckBox';

import OpenGraph from './OpenGraph';

import { useSpring, animated, config } from 'react-spring';
import useMeasure from 'react-use-measure';

import type { LinkT } from './types';
const useStyles = makeStyles((theme) => ({
    container: {
        backgroundColor: theme.palette.primary.light,
        position: 'relative',
    },
    inner: {},
    innerOpen: {
        padding: theme.spacing(2),
    },
    collapsed: {
        padding: theme.spacing(2),
        cursor: 'pointer',
    },
    completionBox: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
    completionIcon: {
        fontSize: theme.spacing(4),
    },
}));

const AnimatedPaper = animated(Paper);

// TODO: hide if not completed.
const LinkItem = ({ link }: { link: LinkT }) => {
    const styles = useStyles();
    const [open, setOpen] = React.useState(false);
    // on open, should scroll it to the top.
    const linkText = link.url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');

    const [ref, { height }] = useMeasure();
    const props = useSpring({
        height,
        config: {
            mass: 1,
            tension: 1000,
            friction: 70,
        },
    });

    const completionBox = (
        <IconButton className={styles.completionBox}>
            {link.completed ? (
                <CheckBoxIcon className={styles.completionIcon} />
            ) : (
                <CheckBoxOutlineBlankIcon className={styles.completionIcon} />
            )}
        </IconButton>
    );

    if (!link.fetchedContent) {
        return (
            <Paper className={styles.container}>
                <Link href={link.url} target="_blank" className={styles.inner}>
                    {linkText}
                </Link>
                {completionBox}
            </Paper>
        );
    }

    return (
        <AnimatedPaper
            style={{
                overflow: 'hidden',
                ...props,
            }}
            className={styles.container}
        >
            <div ref={ref} className={open ? styles.innerOpen : styles.inner}>
                {open ? (
                    <OpenGraph
                        onClose={() => setOpen(false)}
                        data={link.fetchedContent}
                        url={link.url}
                    />
                ) : (
                    <div
                        className={styles.collapsed}
                        onClick={() => setOpen(!open)}
                    >
                        {linkText}
                    </div>
                )}
                {completionBox}
            </div>
        </AnimatedPaper>
    );
};

export default LinkItem;
