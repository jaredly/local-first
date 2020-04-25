// @flow
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Cancel from '@material-ui/icons/Cancel';
import CheckCircle from '@material-ui/icons/CheckCircle';
import * as React from 'react';

const INDENT = 24;

const Description = ({ text, onChange }: { text: string, onChange: (string) => void }) => {
    const styles = useStyles();
    const [editing, onEdit] = React.useState(null);
    return editing != null ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <TextField
                multiline
                style={{ flex: 1 }}
                value={editing}
                onChange={(evt) => onEdit(evt.target.value)}
                onKeyDown={(evt) => {
                    if (evt.key === 'Enter' && (evt.metaKey || evt.shiftKey || evt.ctrlKey)) {
                        if (editing != text) {
                            onChange(editing);
                        }
                        onEdit(null);
                    }
                }}
            />
            <IconButton
                onClick={() => {
                    if (editing != text) {
                        onChange(editing);
                    }
                    onEdit(null);
                }}
            >
                <CheckCircle />
            </IconButton>
            <IconButton onClick={() => onEdit(null)}>
                <Cancel />
            </IconButton>
        </div>
    ) : (
        <div
            onClick={() => onEdit(text)}
            style={{
                fontStyle: 'italic',
                whiteSpace: 'pre-wrap',
            }}
        >
            {!!text ? text : 'Add description'}
        </div>
    );
};

export default Description;

const useStyles = makeStyles((theme) => ({}));
