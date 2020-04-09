#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

cd ../../../
node pack
cd public/whiteboard-server
git commit -am 'update'
git push origin master:update