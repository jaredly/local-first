// @flow

module.exports = (baseDir: string, port: number) => {
    const express = require('express');
    const ws = require('express-ws');

    const fs = require('fs');
    const app = express();
    const wsInst = ws(app);
    app.use(require('cors')());
    app.use(require('body-parser').json());

    app.post('/:id', (req, res) => {
        console.log('writing', req.params);
        fs.writeFileSync(
            baseDir + '/' + req.params.id,
            JSON.stringify(req.body),
        );
        res.status(204);
        res.end();
    });

    app.get('/:id', (req, res) => {
        console.log('getting', req.params);
        const path = baseDir + '/' + req.params.id;
        if (fs.existsSync(path)) {
            res.send(fs.readFileSync(path, 'utf8'));
        } else {
            res.status(404);
        }
        res.end();
    });

    const http = app.listen(port);
    return { http, app, wsInst };
};
