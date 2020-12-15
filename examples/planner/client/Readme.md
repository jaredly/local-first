# Todo

I really need to sort out this "cannot update something I don't have" error.
It's happening in the wild, sometimes after a long wait kind of thing.

Certainly the simplest option would be: when I encounter a syncing error like this, I request
a full dump of the data state.

And then its all good.

Yeah let's do that.

So, that doesn't fix "I made a change and forgot to send it". But we can assume that won't happen much?



Ok, so I need to write a test, right?
Do I even have tests?



Um so apparently my fix didn't even totally work? There was some more broken way that things were? including some node with undefined children? idk.
oh, it was that there was an update being applied out of order. which definitely shouldn't happen?
And didn't happen once I deleted the app & restarted it....
