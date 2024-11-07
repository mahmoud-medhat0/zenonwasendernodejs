const authorizedDomains = ['http://wa-sender.local/', 'http://localhost:3000','https://wasender.zenonsoftware.com/'];

function checkAuthorizedDomains(req, res, next) {

    const origin = req.headers.origin || `http://${req.headers.host}`;
    console.log("Origin:", origin); // Log the origin for debugging
    if (authorizedDomains.includes(origin)) {
        next();
    } else {
        res.status(403).send('Domain not authorized');
    }
}

export default checkAuthorizedDomains;
