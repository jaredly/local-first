# Schema-based server rejection

the server knows what the schema is for a given collection; and if something comes in that violates the schema, the delta is rejected & the whole node is send back with an "override" flag.
This would require/assume that the server gets updated before the clients.

# Collection-level ACLs

Would you be able to do everything you want with only collection-level ACLs?
This would mean that e.g. "comments" on a doc would live in a separate collection from the doc itself.

Also, would you be able to approximate the "suggestion" feature of google docs? I think those would also be stored in the "comments" collection, with some metadata on the comment indicating the suggestion.

So you would do something like `setAccess(collectionId, access)`

where access is

```
type Access = {
    type: 'public',
} | {
    type: 'private',
}
```

# I should include an example that has local full-text search via lunar.js or something

# Google drive

So we're syncing to a file, I imagine, and that file will be a collection of collections.
So for notablemind, it would be

```
{
    meta: {'': {title, nodeCount, etc.}},
    tags: {[tid]: Tag},
    nodes: {[nid]: Node},
}
```

So this means there's a notion of a "database" that is a group of collections.
