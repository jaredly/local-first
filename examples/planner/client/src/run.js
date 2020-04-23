// @flow
import run from './';

if (window.location.pathname === '/local') {
    run(null, 'planner-blob');
} else {
    run('localhost:9090', 'planner');
}
