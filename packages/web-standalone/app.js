import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

const app = express()
const port = process.env.PORT || 4004

app.use(express.static('static'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/', (req, res, next) => {
    res.set("Access-Control-Allow-Origin", '*')
    res.set("Access-Control-Allow-Methods", 'GET, POST, OPTIONS, HEAD')
    res.set("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, usefirebaseauth, srawungtoken, Accept, Develop-by, bb-token, User-Agent, Content-Disposition")
    res.set("Access-Control-Expose-Headers", '*');
    if (req.method.toLowerCase() === 'options') {
        res.end('OKE');
    }
    else {
        next();
    }
});


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, 'data.json');
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/json') {
        cb(null, true);
    } else {
        cb(new Error('Only .json files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});
app.post('/backup', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Tidak ada file yang diunggah.');
        }
        res.send('File berhasil diunggah dan disimpan.');
    } catch (error) {
        console.error('Terjadi kesalahan saat mengunggah file:', error);
        res.status(500).send('Terjadi kesalahan saat mengunggah file.');
    }
});

app.get('/restore', (req, res) => {
    fs.readFile('uploads/data.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send({ message: 'Failed to read JSON data', error: err });
        }

        try {
            const jsonData = JSON.parse(data);
            res.status(200).send(jsonData);
        } catch (parseError) {
            res.status(500).send({ message: 'Failed to parse JSON data', error: parseError });
        }
    });
});

app.post('/proxy', async (req, res) => {
    const url = req.headers['x-proxy-req-url']
    const method = req.headers['x-proxy-req-method']
    const headers = {}
    const body = req.body

    Object.keys(req.headers).forEach(header => {
        if (header.startsWith('x-proxy-req-header-')) {
            headers[header.replace('x-proxy-req-header-', '')] = req.headers[header]
        }
    })

    try {
        const startTime = new Date()

        const response = await fetch(url, {
            method,
            headers,
            body: method !== 'GET' ? body : undefined
        })

        const endTime = new Date()

        const status = response.status
        const statusText = response.statusText
        const responseHeaders = [...response.headers.entries()]

        const responseBlob = await response.blob()
        const mimeType = responseBlob.type
        const buffer = await responseBlob.arrayBuffer()

        const timeTaken = endTime - startTime

        const responseToSend = {
            status,
            statusText,
            headers: responseHeaders,
            mimeType,
            buffer: Array.from(new Uint8Array(buffer)),
            timeTaken
        }

        res.send({
            event: 'response',
            eventData: responseToSend
        })
    } catch (e) {
        res.send({
            event: 'responseError',
            eventData: e.message
        })
    }
})

app.listen(port, () => {
    console.log(`Restfox running on port http://localhost:${port}`)
})
