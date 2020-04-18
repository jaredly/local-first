// @flow
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';
import Autocomplete from '@material-ui/lab/Autocomplete';
import TextField from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import Label from '@material-ui/icons/Label';
import * as React from 'react';
import { animated, useSpring } from 'react-spring';
import useMeasure from 'react-use-measure';
import OpenGraph from './OpenGraph';
import type { LinkT, TagT } from './types';
import Chip from '@material-ui/core/Chip';
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
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    completionIcon: {
        fontSize: theme.spacing(4),
    },
    deleteButton: {
        marginTop: theme.spacing(1),
        marginRight: theme.spacing(1),
    },
    tags: {
        paddingLeft: theme.spacing(2),
        paddingBottom: theme.spacing(1),
    },
    // openTags: {
    //     paddingBottom: theme.spacing(1),
    // },
    // editTags: {
    //     paddingBottom: theme.spacing(1),

    // },
    tag: {
        marginRight: theme.spacing(1),
    },
    bottom: {
        marginTop: theme.spacing(2),
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

    const [editTags, setEditTags] = React.useState(null);

    const [reallyDelete, setReallyDelete] = React.useState(false);

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

    const currentTags = Object.keys(link.tags)
        .filter((k) => link.tags[k])
        .map((k) => tags[k])
        .filter(Boolean);

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
                        <div className={styles.bottom}>
                            {editTags ? (
                                <div>
                                    <Autocomplete
                                        multiple
                                        id="tags-standard"
                                        options={Object.keys(tags).map(
                                            (k) => tags[k],
                                        )}
                                        getOptionLabel={(option) =>
                                            option.title
                                        }
                                        value={editTags.map((k) => tags[k])}
                                        onChange={(_, tags) =>
                                            setEditTags(
                                                tags.map((tag) => tag.id),
                                            )
                                        }
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                variant="standard"
                                                label="Tags"
                                                placeholder="Tags"
                                            />
                                        )}
                                    />
                                    <Button
                                        onClick={() => {
                                            // TODO would be better to merge these
                                            const tags = {};
                                            editTags.map(
                                                (k) => (tags[k] = true),
                                            );
                                            linksCol.setAttribute(
                                                link.id,
                                                ['tags'],
                                                tags,
                                            );
                                            setEditTags(null);
                                        }}
                                    >
                                        Set
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setEditTags(null);
                                            // would be nice to have an "undo" within easy reach, right?
                                            // would that just consist of "recreating" it?
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div
                                    className={styles.openTags}
                                    onClick={() => {
                                        setEditTags(
                                            currentTags.map((t) => t.id),
                                        );
                                    }}
                                >
                                    {currentTags.map((tag) => (
                                        <Chip label={tag.title} />
                                    ))}
                                    {currentTags.length === 0
                                        ? 'No tags'
                                        : null}
                                </div>
                            )}

                            {reallyDelete ? (
                                <React.Fragment>
                                    <Button
                                        className={styles.deleteButton}
                                        onClick={() => {
                                            setReallyDelete(false);
                                        }}
                                    >
                                        Just kidding
                                    </Button>
                                    <Button
                                        className={styles.deleteButton}
                                        variant="contained"
                                        onClick={() => {
                                            linksCol.delete(link.id);
                                            // would be nice to have an "undo" within easy reach, right?
                                            // would that just consist of "recreating" it?
                                        }}
                                    >
                                        Really Delete
                                    </Button>
                                </React.Fragment>
                            ) : (
                                <Button
                                    className={styles.deleteButton}
                                    onClick={() => {
                                        setReallyDelete(true);
                                        // would be nice to have an "undo" within easy reach, right?
                                        // would that just consist of "recreating" it?
                                    }}
                                >
                                    Delete
                                </Button>
                            )}
                        </div>
                    </div>
                ) : currentTags.length > 0 ? (
                    <div className={styles.tags}>
                        {currentTags.map((tag) => (
                            <Chip
                                label={tag.title}
                                className={styles.tag}
                                size="small"
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </AnimatedPaper>
    );
};

export default LinkItem;
