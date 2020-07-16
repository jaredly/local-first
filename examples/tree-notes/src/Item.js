// @flow
import * as React from 'react';
import { useCollection, useItem } from '../../../packages/client-react';
import { type Client } from '../../../packages/client-bundle';
import QuillEditor from './QuillEditor';

const Item = ({ id, client }: { id: string, client: Client<*> }) => {
    const [col, item] = useItem(React, client, 'items', id);

    if (item === false) {
        return null; // loading
    }
    if (item == null) {
        return 'Item does not exist';
    }
    return (
        <div>
            <QuillEditor
                value={item.body}
                getStamp={client.getStamp}
                onChange={(body) => col.applyRichTextDelta(id, ['body'], body)}
                // onChange={(body) => col.
                siteId={client.sessionId}
            />
        </div>
    );
};

export default Item;
