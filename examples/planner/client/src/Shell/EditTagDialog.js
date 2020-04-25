// @flow
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import pako from 'pako';
import * as React from 'react';
import type { Client, SyncStatus, Collection } from '../../../../../packages/client-bundle';
import type { TagT } from '../types';

const genId = () => Math.random().toString(36).slice(2);

const useStyles = makeStyles((theme) => ({
    container: {
        padding: theme.spacing(2),
        display: 'flex',
        flexDirection: 'column',
    },
    buttons: {
        marginTop: theme.spacing(2),
    },
}));

const emptyTag = {
    id: '',
    title: '',
    color: '',
};

const EditTagDialog = ({
    tag,
    client,
    onClose,
    tagsCol,
}: // getStamp,
{
    tag: ?TagT,
    client: Client<SyncStatus>,
    onClose: () => void,
    tagsCol: Collection<TagT>,
    // getStamp: () => string,
}) => {
    const styles = useStyles();
    const [loading, setLoading] = React.useState(false);
    const id = React.useMemo(() => 'id-' + genId(), []);

    const [tagData, setTagData] = React.useState(tag != null ? { ...tag } : emptyTag);

    return (
        <Dialog open={true} aria-labelledby={id} onClose={onClose}>
            <DialogTitle id={id}>{tag === null ? 'Create Tag' : 'Edit Tag'}</DialogTitle>
            <div className={styles.container}>
                <TextField
                    placeholder="Tag Title"
                    value={tagData.title}
                    onChange={(evt) => setTagData({ ...tagData, title: evt.target.value })}
                />
                <div className={styles.buttons}>
                    <Button
                        variant="contained"
                        color="primary"
                        disabled={loading}
                        onClick={() => {
                            if (tag == null) {
                                const tag = {
                                    ...tagData,
                                    id: client.getStamp(),
                                };
                                tagsCol.save(tag.id, tag);
                            } else {
                                if (tagData.title !== tag.title) {
                                    tagsCol.setAttribute(tagData.id, ['title'], tagData.title);
                                }
                                if (tagData.color !== tag.color) {
                                    tagsCol.setAttribute(tagData.id, ['color'], tagData.color);
                                }
                            }
                            onClose();
                        }}
                    >
                        {tag == null ? 'Create' : 'Save'}
                    </Button>
                    <Button
                        // variant="contained"
                        color="primary"
                        disabled={loading}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </Dialog>
    );
};

export default EditTagDialog;
