#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

cd ../../../
(cd public/planner-server && git pull origin master)
node pack planner
cd public/planner-server
git commit -am 'update'
git push origin master:update
