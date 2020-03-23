// @flow
// Ok folks

export type TmpNode = {
    id: [number, string],
    after: [number, string],
    text: string,
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

export type Content =
    | {|
          type: 'text',
          text: string,
      |}
    | {|
          type: 'open',
          key: string,
          value: any,
          stamp: string,
      |}
    | {|
          type: 'close',
          key: string,
          stamp: string,
      |};

export const rootSite = '0:-root-';
export const rootSiteRight = '1:-root-';

export type CRDT = {|
    largestIDs: { [site: string]: number },
    roots: Array<string>,
    map: { [key: string]: Node },
|};

export type Loc = { id: number, site: string, pre: boolean };

export type Span = { id: number, site: string, length: number };

export type Delta =
    | {|
          type: 'insert',
          id: [number, string],
          after: [number, string],
          text: string,
      |}
    | {| type: 'delete', spans: Array<Span> |}
    // | {|
    //       type: 'update',
    //       // need to go through each span and delete the things
    //       delete?: Array<Span>,
    //       // These will be inserted in array order, and so are allowed
    //       // to be dependent on previous items in the array
    //       insert?: Array<TmpNode>,
    //   |}
    | {|
          type: 'delete-format',
          stamp: string,
          open: [number, string],
          close: [number, string],
      |}
    | {|
          type: 'format',
          open: {
              id: [number, string],
              after: [number, string],
          },
          close: {
              id: [number, string],
              after: [number, string],
          },
          key: string,
          value: any,
          stamp: string,
      |};
