const puppeteer = require('puppeteer');
const Bundler = require('parcel');

const port = 9223;
(async () => {
    const bundler = new Bundler([__dirname + '/index.html'], {});
    bundler.serve(port);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const target = `http://localhost:${port}/`;
    console.log('nav to', target);
    await page.goto(target);
    await page.screenshot({ path: 'example.png' });

    await browser.close();
})();
