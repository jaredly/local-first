// @flow

export type Span = { id: number, site: string, length: number };

export type PreNode<Format> = {|
    id: [number, string],
    after: [number, string],
    text: string,
    deleted?: boolean,
    // I'll parameterize on it, -- you provide your own "format" crdt
    format?: ?Format,
|};

export type Node<Format> = {|
    id: [number, string],
    // this is the actual node we're under
    parent: string,
    text: string,
    deleted?: boolean,
    format?: ?Format,
    // the number of *non-deleted* characters contained in this tree
    size: number,
    children: Array<Node<Format>>,
|};

export type CRDT<Format> = {|
    site: string,
    largestLocalId: number,
    roots: Array<Node<Format>>,
    map: { [key: string]: Node<Format> },
|};

export type Delta<Format> =
    | {
          type: 'insert',
          span: PreNode<Format>,
      }
    | {
          type: 'delete',
          positions: Array<Span>,
      }
    | {
          type: 'format',
          positions: Array<Span>,
          format: Format,
      };
