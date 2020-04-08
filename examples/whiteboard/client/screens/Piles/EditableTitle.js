// @flow
/* @jsx jsx */
import { jsx } from '@emotion/core';
import React from 'react';

const EditableTitle = ({ title, onChange }: { title: string, onChange: (string) => mixed }) => {
    const [wip, setWip] = React.useState(null);
    if (wip != null) {
        return (
            <div>
                <input
                    value={wip}
                    onChange={(evt) => setWip(evt.target.value)}
                    onKeyDown={(evt) => {
                        if (evt.key === 'Enter' && wip.trim() != '' && wip !== title) {
                            onChange(wip);
                            setWip(null);
                        }
                    }}
                    onBlur={() => setWip(null)}
                    css={styles.titleInput}
                    autoFocus
                />
            </div>
        );
    }
    return (
        <div
            onDoubleClick={(evt) => {
                setWip(title);
            }}
            css={{ fontSize: 32 }}
        >
            {title}
        </div>
    );
};

const styles = {
    titleInput: {
        fontSize: 32,
        padding: 0,
        fontWeight: 'inherit',
        border: 'none',
        textAlign: 'center',
    },
};

export default EditableTitle;
