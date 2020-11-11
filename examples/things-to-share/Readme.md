# Developing:

If you want to run against the prod data, then `cd client && yarn start` will do it.
Otherwise, `cd server && yarn start`, and change `client/src/index.js` to point to `localhost:9090`.

# Deploying
For server changes: `cd server && yarn run deploy`. Then in the glitch terminal, `git merge updates`
For client changes: `cd client && yarn run deploy`

