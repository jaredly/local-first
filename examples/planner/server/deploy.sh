#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

cd ../../../
(cd public/things-to-share-server && git pull)
node pack
cd public/things-to-share-server
git commit -am 'update'
git push origin master:update