const puppeteer = require('puppeteer');
const config = require('./config.js');
let {accessToken} = config;

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

(async() => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});
    await page.goto('https://oauth.semrush.com/api/v1/ta?domain=bankier.pl&access_token='+accessToken, {waitUntil: 'networkidle2'});
    await timeout(10000)
    await page.screenshot({path: 'example.png'});
    browser.close();

})();