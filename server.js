const express = require('express');
const axios = require('axios');
const path = require('path');
const cloudScraper = require('cloudscraper');
const bodyParser = require('body-parser')
const moment = require('moment')
const fs = require('fs');
const puppeteer = require('puppeteer');
const url = require('url');

const config = require('./config.js');
const fakeData = require('./fake.js')

const app = express();
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// parse application/json
app.use(bodyParser.json())

const {apiToken, SERPApiToken, port = 3030, cloudflareTimeout = 5000} = config;

// set up the request parameters
const SERPParams = {
    api_key: SERPApiToken
}


const makeId = (length = 16) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return `${result}_${moment().unix()}`;
}


const renderPage = (htmlContent, callback) => {
    const randomString = makeId();
    const filePath = `${path.resolve(__dirname + '/pages/', randomString)}.html`;
    const resultsPath = path.resolve(__dirname + '/results/', randomString);
    const pdfFile = `${resultsPath}.pdf`
    fs.writeFile(filePath, htmlContent, (err) => {
        console.log(err);
    });
    (async () => {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(`file://${filePath}`);
        await page.pdf({
            path: pdfFile,
            format: 'A4',
            margin: {
                top: "20px",
                left: "20px",
                right: "20px",
                bottom: "20px"
            }
        });
        await page.screenshot({path: `${resultsPath}.png`});
        await browser.close();
        callback({
            pdfFile
        });
    })();
}

const sendCFRequest = ({callback, url, qs, formData, method = 'GET'}) => {
    const options = {
        cloudflareTimeout,
        url,
        headers: {
            'Cache-Control': 'private',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        },
        method,
        qs,
        formData
    };

    return cloudScraper(options)
        .then(function (data) {
            return callback({
                status: "success",
                data
            })
        })
        .catch(function (error) {
            return callback({
                status: 'error',
                data: error
            });
        });
};

const getWebsiteContentRequest = (url, callback) => {
    return sendCFRequest({
        callback,
        url
    })
};

const sendSERPRequest = (data, callbackSuccess, callbackError) => {
    const params = {...SERPParams, ...data};
    // make the http GET request to Scale SERP
    axios.get('https://api.scaleserp.com/search', {
        params
    })
        .then(response => {
            // console.log(response.data);
            // print the JSON response from Scale SERP
            callbackSuccess(JSON.stringify(response.data, 0, 2));

        }).catch(error => {
        // catch and print the error
        callbackError(error);
    })
}

app.post('/render-website', (req, res) => {
    const data = req.body || {}
    const {token} = data;
    const htmlContent = data.html_content;
    if (!htmlContent || apiToken !== token) {
        res.send();
    } else {
        renderPage(htmlContent, (data = {}) => {
            const {pdfFile} = data;
            res.send({
                status: 'success',
                data: {
                    filename: path.basename(pdfFile)
                }
            });
        });
    }
});

app.get('/download-website', (req, res) => {
    const urlParts = url.parse(req.url, true);
    const query = urlParts.query || {};
    const {filename, token} = query;
    if (!filename || apiToken !== token) {
        res.send();
    } else {
        const fileToSent = fs.readFileSync(path.resolve(__dirname + '/results/', filename));
        res.contentType("application/pdf");
        res.send(fileToSent);
    }
});

app.post('/check-website', (req, res) => {
    const data = req.body || {}
    const {url, token} = data;
    if (!url || apiToken !== token) {
        res.send();
    } else {
        getWebsiteContentRequest(url, (body) => {
            res.send(body)
        });
    }
});

app.post('/check-keyword', (req, res) => {
    const data = req.body || {}
    const {q, location = 'Warsaw,Masovian Voivodeship,Poland', gl = 'pl', hl = 'pl', token} = data;
    if (!q || apiToken !== token) {
        res.send();
    } else {
        res.send(fakeData);
        return false;
        return sendSERPRequest({
            q,
            location,
            gl,
            hl
        }, (response) => {
            res.send({
                status: 'success',
                data: response
            });
        }, (error) => {
            res.send({
                status: 'error',
                data: error
            });
        });
    }
});

app.listen(port, () => console.log('App listening on port ' + port + '!'));
