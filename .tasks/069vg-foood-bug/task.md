examples/foood: Some users are reporting an issue with foood where sometimes they'll open up the page (after having previously logged in, browsed recipes, etc.) and all the recipes will be gone. It looks like a blank database, but the 'connection' wifi icon is on, and reloading the page does nothing.
The only solution is to click 'Teardown client' on the debug page, and then it refetches the database in its entirity.

Can you figure out what circumstance might cause this? I think it's only been happening on phones (so maybe there's a storage pressue issue?)
