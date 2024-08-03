const express = require('express');
const logger = require('@coya/logger')();
const path = require('path');

const config = require('../config');
const LinkedinClient = require('./LinkedinClient');

// configuration variables
const maximumShotsNumber = 10;
const serverPort = 8080;
const webAppFile = path.resolve(__dirname, '../web/index.html');
const webAssetsFolder = path.resolve(__dirname, '../web/assets');

function createApp() {
	const linkedinClient = new LinkedinClient(config.cookie);

	const app = express();
	app.logger = logger; // this way, it can be silented in tests
	app.use('/assets', express.static(webAssetsFolder));

	// web app
	app.get('/', (req, res) => {
		res.sendFile(webAppFile);
	});

	// API endpoint
	app.get('/request', saveIpAddress, async (req, res) => {
		logger.info(`Request received from IP address = ${req.ipAddress} with linkedin URL = ${req.query.linkedinUrl}`);

		if (!req.query.linkedinUrl)
			return res.json({ error: 'A linkedin URL is required.' });

		try {
			logger.info(`Sending request to ${req.query.linkedinUrl}...`);
			const result = await linkedinClient.fetch(req.query.linkedinUrl);
			if (!result)
				res.json({ error: 'The people/company has not been found.', result: null });
			else
				res.json({ error: null, result });
			logger.info('Response sent !');
		} catch (e) {
			logger.error(e);
			res.json({ error: e.message, result: null });
		}
	});

	return app;
}

if (process.env.NODE_ENV === 'test')
	module.exports = { createApp };
else {
	(async () => {
		const app = createApp();
		app.listen(serverPort);
		logger.info(`Server started on "http://localhost:${serverPort}", waiting for requests...`);
	})();
}

const ipAddresses = {};
function saveIpAddress(req, res, next) {
	const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).replace('::ffff:', '');
	ipAddresses[ipAddress] = (ipAddresses[ipAddress] || 0) + 1;
	logger.info('Number of shots for this address : ' + ipAddresses[ipAddress]);
	if (ipAddresses[ipAddress] > maximumShotsNumber)
		res.json({ error: 'You have reached your maximum number of trials, contact me if you wish to work with me.' });
	else {
		req.ipAddress = ipAddress;
		next();
	}
}
