# local-first packages & explorations

This aims to eventually be a fully-featured solution for managing, syncing, and storing application data, in a way that works offline, and collaboratively. See [this article](https://www.inkandswitch.com/local-first.html) for more info about the name.

Currently implemented
- a hybrid logical clock ([blog post](https://jaredforsyth.com/posts/hybrid-logical-clocks/), [code](https://github.com/jaredly/local-first/tree/master/packages/hybrid-logical-clock))
- a nested object CRDT ([code](https://github.com/jaredly/local-first/tree/master/packages/nested-object-crdt))
- a rich-text CRDT ([code](https://github.com/jaredly/local-first/tree/master/packages/text-crdt), [example integration with quill](https://github.com/jaredly/local-first/tree/master/examples/quill-crdt), [visualization of the data structure](https://github.com/jaredly/local-first/tree/master/examples/visualize))