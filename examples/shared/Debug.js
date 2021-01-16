// @flow
import * as React from 'react';
import Button from '@material-ui/core/Button';
// import IconButton from '@material-ui/core/IconButton';
// import SearchIcon from '@material-ui/icons/Search';
// import AddIcon from '@material-ui/icons/Add';
// import { useCollection, useItem } from '../../../packages/client-react';
// import type { Data } from '../shared/auth-api';
// import type { AuthData } from '../shared/Auth';
import type { Client, Collection } from '../../packages/client-bundle';
import ExportDialog from './ExportDialog';
import ImportDialog from './ImportDialog';

const Debug = ({ client }: { client: Client<*> }) => {
    const [dialog, setDialog] = React.useState(null);

    return (
        <div>
            Debug actions:
            <div style={{ margin: '8px 0' }}>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        client.teardown();
                    }}
                >
                    Teardown client
                </Button>{' '}
                (delete all data, to refresh from the server)
            </div>
            <div style={{ margin: '8px 0' }}>
                <Button variant="contained" color="primary" onClick={() => setDialog('export')}>
                    Export all data
                </Button>
            </div>
            <div style={{ margin: '8px 0' }}>
                <Button variant="contained" color="primary" onClick={() => setDialog('import')}>
                    Import
                </Button>
            </div>
            <ExportDialog
                open={dialog === 'export'}
                client={client}
                onClose={() => setDialog(null)}
            />
            <ImportDialog
                open={dialog === 'import'}
                client={client}
                onClose={() => setDialog(null)}
            />
        </div>
    );
};

export default Debug;
