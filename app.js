const express = require('express');
const bodyParser = require('body-parser');
const sessionRoutes = require('./routes/sessionRoutes');
const WaMessagesRoutes = require('./routes/WaMessagesRoutes');
const sessionController = require('./controllers/sessionController');
const config = require('./config/config');
const sessionTokenMiddleware = require('./middleware/sessionTokenMiddleware');
const checkAuthorizedDomainsMiddleware = require('./middleware/authorizedDomainsMiddleware');
const app = express();
app.use(bodyParser.json());

app.use(checkAuthorizedDomainsMiddleware);
app.use(sessionTokenMiddleware);
app.use(sessionRoutes);

app.use(WaMessagesRoutes);
setInterval(() => {
    sessionController.updateSessions();
}, 1000 * 60 * 10) ;
app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);

});
