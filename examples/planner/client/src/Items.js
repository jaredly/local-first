// @flow
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';
import { makeStyles } from '@material-ui/core/styles';
import * as React from 'react';
import type { Client, SyncStatus } from '../../../../packages/client-bundle';
import { useItem } from '../../../../packages/client-react';
import { ItemChildren } from './Item';
import { newItem } from './types';

const useStyles = makeStyles((theme) => ({
    container: {},
}));

const Items = ({ client }: { client: Client<SyncStatus> }) => {
    const styles = useStyles();

    const [col, root] = useItem(React, client, 'items', 'root');

    return (
        <Container maxWidth="sm" className={styles.container}>
            <Button onClick={() => client.undo()}>Undo</Button>
            {root ? (
                <ItemChildren level={-1} item={root} client={client} col={col} />
            ) : (
                <div className={styles.empty}>
                    Hello! Let's get you started.
                    <Button
                        onClick={() => {
                            col.save('root', { ...newItem('root', 'Planner'), style: 'group' });
                        }}
                    >
                        Start this off
                    </Button>
                </div>
            )}
        </Container>
    );
};

export default Items;
