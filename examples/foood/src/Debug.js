// @flow
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';

import querystring from 'querystring';
import ListItem from '@material-ui/core/ListItem';
import Switch from '@material-ui/core/Switch';
import Button from '@material-ui/core/Button';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import * as React from 'react';
import {
    createPersistedBlobClient,
    createPersistedDeltaClient,
    createPollingPersistedDeltaClient,
    createInMemoryDeltaClient,
    createInMemoryEphemeralClient,
} from '../../../packages/client-bundle';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import AddIcon from '@material-ui/icons/Add';
import { useCollection, useItem } from '../../../packages/client-react';
import type { Data } from '../../shared/auth-api';
import type { AuthData } from '../../shared/Auth';
import type { Client, Collection } from '../../../packages/client-bundle';

const Debug = ({ client }: { client: Client<*> }) => {
    return (
        <div>
            Debug it up
            <Button
                variant="contained"
                color="primary"
                onClick={() => {
                    client.teardown();
                }}
            >
                Teardown client (delete all data, to refresh from the server)
            </Button>
        </div>
    );
};

export default Debug;
