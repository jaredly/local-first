# local-first packages & explorations

This aims to eventually be a fully-featured solution for managing, syncing, and storing application data, in a way that works offline, and collaboratively. See [this article](https://www.inkandswitch.com/local-first.html) for more info about the name.

Currently implemented
- a hybrid logical clock ([blog post](https://jaredforsyth.com/posts/hybrid-logical-clocks/), [code](https://github.com/jaredly/local-first/tree/master/packages/hybrid-logical-clock))
- a nested object CRDT ([code](https://github.com/jaredly/local-first/tree/master/packages/nested-object-crdt))
- a rich-text CRDT ([code](https://github.com/jaredly/local-first/tree/master/packages/text-crdt), [example integration with quill](https://github.com/jaredly/local-first/tree/master/examples/quill-crdt), [visualization of the data structure](https://github.com/jaredly/local-first/tree/master/examples/visualize))


## Data migrations

What if:
- when changing the model:
  - clients who are behind would show a message, and would be able to *send* updates, but not *receive* them
  - the server would need to know how to interpret updates from the previous version
  - when the user clicks "upgrade me", we finish sending our updates, and then teardown the clients and refetch all data from the server. (this requires the server to be reifying nodes, otherwise it's a little ridiculous)
  - then refresh the page? probably.
  - oh but also we need to manage the upgrading of the client to the new javascript 🤔.... I'm not sure how to do that.
    - well I mean I guess if the service worker installs the new infos, and the app starts up and sees that data hasn't been upgraded, it can just enter "upgrading mode", and do that.
    - how do I think about upgrading "deltas"? Like, if someone comes online and is like "give me the past 2 weeks of changes", I would need to have upgraded them, right? But that seems fraught.
    - so it's better to just send them ... all nodes that have changed, right? 
    Wait no. We can assume that data model upgrades represent a hard break; noone will have "partial" upgraded data. They either have pre-break non-upgraded data, or post-break upgraded data. There's no way to have pre-break upgraded data, or post-break non-upgraded data. Because the upgrade process involves a full refresh.

Bugs/questions:
- why, when updating from the admin script, does the website not do realtime updates?
- I need an auth status that is "invalid/expired", so that people can keep on with their lives, and re-sign in when they're ready.
