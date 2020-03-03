// @flow
// Ok folks

export type TmpNode = {
    id: [number, string],
    after: [number, string],
    content: Content,
};

export type Node = {
    id: [number, string],
    parent: string,
    deleted?: ?boolean,
    size: number,
    children: Array<string>,
    content: Content,
    // Mapping from format-attribute to a list of node IDs (opening tags)
    formats: { [key: string]: Array<string> },
};

// This could just be an optional string...
export type Content =
    | {
          type: 'text',
          text: string,
      }
    | {
          type: 'dot',
      };

export const rootSite = '0:-root-';
export const rootSiteRight = '1:-root-';

export type Mark = {
    id: string,
    start: { id: string, stamp: string },
    end: { id: string, stamp: string },
    key: string,
    value: any,
};

export type CRDT = {
    site: string,
    largestLocalId: number,
    roots: Array<string>,
    map: { [key: string]: Node },
    marks: { [key: string]: Mark },
    // should I have a "marksByStart" cache?
    // ehh probably?
    // Although if I have the "formats" cache on each node, maybe not?
    marksByStart: { [key: string]: Array<string> },
};

export type Loc = { id: number, site: string, pre: boolean };

export type Span = { id: number, site: string, length: number };

export type Delta = {
    type: 'update',
    // need to go through each span and delete the things
    delete?: Array<Span>,
    // These will be inserted in array order, and so are allowed
    // to be dependent on previous items in the array
    insert?: Array<TmpNode>,
};
