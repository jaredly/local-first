// @flow
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import * as React from 'react';
import { animated, useSpring } from 'react-spring';
import useMeasure from 'react-use-measure';
import OpenGraph from './OpenGraph';
import type { LinkT, TagT } from './types';
import { type Collection } from '../../../../packages/client-bundle';

const useStyles = makeStyles((theme) => ({
    container: {
        backgroundColor: theme.palette.primary.light,
        position: 'relative',
    },
    inner: {
        flex: 1,
    },
    innerOpen: {
        padding: theme.spacing(2),
    },
    collapsed: {
        padding: theme.spacing(2),
        cursor: 'pointer',
    },
    titleRow: {
        cursor: 'pointer',
        // paddingLeft: theme.spacing(2),
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    // completionBox: {
    //     position: 'absolute',
    //     top: 0,
    //     right: 0,
    // },
    completionIcon: {
        fontSize: theme.spacing(4),
    },
}));

const AnimatedPaper = animated(Paper);

// TODO: hide if not completed.
const LinkItem = ({
    link,
    linksCol,
    tags,
}: {
    link: LinkT,
    linksCol: Collection<LinkT>,
    tags: { [key: string]: TagT },
}) => {
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

    // if (link.fetchedContent == null) {
    //     return (
    //         <Paper className={styles.container + ' ' + styles.titleRow}>
    //             <Link href={link.url} target="_blank" className={styles.inner}>
    //                 {linkText}
    //             </Link>
    //             {completionBox}
    //         </Paper>
    //     );
    // }

    return (
        <AnimatedPaper
            style={{
                overflow: 'hidden',
                ...props,
            }}
            className={styles.container}
        >
            <div ref={ref}>
                <div className={styles.titleRow} onClick={() => setOpen(!open)}>
                    <IconButton
                        className={styles.completionBox}
                        onClick={(evt) => {
                            evt.stopPropagation();
                            linksCol.setAttribute(
                                link.id,
                                ['completed'],
                                link.completed != null ? null : Date.now(),
                            );
                        }}
                    >
                        {link.completed != null ? (
                            <CheckBoxIcon className={styles.completionIcon} />
                        ) : (
                            <CheckBoxOutlineBlankIcon
                                className={styles.completionIcon}
                            />
                        )}
                    </IconButton>
                    <div
                        style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {linkText}
                    </div>
                </div>
                {open ? (
                    <div className={styles.innerOpen}>
                        {link.fetchedContent != null ? (
                            <OpenGraph
                                data={link.fetchedContent}
                                url={link.url}
                            />
                        ) : (
                            'Unable to fetch content'
                        )}
                    </div>
                ) : null}
            </div>
        </AnimatedPaper>
    );
};

export default LinkItem;
