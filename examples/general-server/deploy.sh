#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

cd ../../
(cd public/general-server && git pull origin master)
node pack general-server
cd public/general-server
git add .
git commit -am 'update'
git push origin master:update
