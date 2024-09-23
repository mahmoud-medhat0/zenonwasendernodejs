module.exports = {
    port: 3000,
    sessionDataPath: './sessions',
    puppeteer: {
        headless: true,
        args: [ '--no-sandbox', '--disable-gpu', ],
    },
};