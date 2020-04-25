// @flow
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import AddBoxOutlined from '@material-ui/icons/Add';
import * as React from 'react';

const INDENT = 24;

const NewItem = ({
    onAdd,
    level,
    onFocus,
}: {
    onAdd: (string) => void,
    level: number,
    onFocus: (boolean) => void,
}) => {
    const [text, setText] = React.useState('');
    const styles = useStyles();

    return (
        <div className={styles.inputWrapper} style={{ paddingLeft: level * INDENT }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <IconButton
                style={{ padding: 9 }}
                onClick={() => {
                    if (text.trim().length > 0) {
                        onAdd(text);
                        setText('');
                    }
                }}
            >
                <AddBoxOutlined />
            </IconButton>
            <input
                type="text"
                value={text}
                onChange={(evt) => setText(evt.target.value)}
                placeholder="Add item"
                className={styles.input}
                onFocus={() => onFocus(true)}
                onBlur={() => onFocus(false)}
                onKeyDown={(evt) => {
                    if (evt.key === 'Enter' && text.trim().length > 0) {
                        onAdd(text);
                        setText('');
                    }
                }}
            />
        </div>
    );
};

export default NewItem;

const useStyles = makeStyles((theme) => ({
    input: {
        color: 'inherit',
        width: '100%',
        // fontSize: 32,
        padding: '4px 8px',
        backgroundColor: 'inherit',
        border: 'none',
        // borderBottom: `2px solid ${theme.palette.primary.dark}`,
        ...theme.typography.body1,
        fontWeight: 300,
    },
    inputWrapper: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
}));
