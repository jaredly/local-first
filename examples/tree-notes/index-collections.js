// @flow

// Things this model needs:
// - info for fetching & syncing the doc
// - info for displaying a list of docs that I don't have downloaded.
export type File = {
    source: {
        url: string, // do we assume it's a general server? no, we only assume that we get a "sync" url I think.
        // and that we need to give an "auth token", right?
        // hmmm.
        // So, if you have this file, but you don't know about that
        // server yet.
        // How do you know how to log in?
        // How about this: if you try to fetch a doc and you're not authorized,
        // it includes in the response JSON or header or something a link to the /auth
        // root. And it should follow the /auth/login etc. API setup.
        type: 'delta' | 'blob', // are there others? hmmm
    },
    // url? ok, this is where it can be replicated from?
    // also maybe client method?
    // ok so it's important to realize that this is synced centrally.
    // Does it make sense for my central index to also index files
    // that aren't hosted at the same place?
    // Seems like there's nothing stopping it.
    // Ok, so we could also have blob storage.
    id: string,
    // Importantly though, we can't have "local only" files represented
    // here, because that wouldn't make any sense.
    // For that, we'll need a "local only index". Which sounds fine.
    // Ok, so we have a "remote index client" (which is where you're auth'd)
    // and a "local index client", for anything that you want to be local only.
    // Can you move files between these two easily? maybe?
    // I kinda built the system that way, but also it's been a minute.

    // Can we have multiple sources for a file?
    // I'm gonna take an initial stance with "no". If I later feel like it,
    // I could add "secondarySources" or whatnot. But I don't actually
    // want to be making a distributed system here.

    // How do we sync things like "title" and "last modified"? I guess by hand.
    // that's not too bad, right?
    title: string,
    lastOpened: number,
    lastModified: number,
    nodeCount: number, // should I do "file size" instead? node count is maybe easier
};

// Ok, so for local-only settings ... like ... idk, "recently opened on this device"
// should I just use localstorage? and be fine that I don't have listeners?
// probably....

const FileSchema = {
    type: 'object',
    attributes: {
        id: 'string',
        source: {
            type: 'object',
            attributes: {
                url: 'string',
                type: 'string',
            },
        },
        title: 'string',
        lastOpened: 'number',
        lastModified: 'number',
        nodeCount: 'number',
    },
};

export const schemas = {
    files: FileSchema,
};
