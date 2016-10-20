"use strict";

const fs = require("fs");
const path = require("path");
const contentful = require("contentful");

var client = contentful.createClient({
	"space": "mo94git5zcq9",
	"accessToken": process.env.CONTENTFUL_ACCESS_TOKEN
});

/**
 * setNextSyncToken
 * @arg {String} destination - path on local disk
 * @arg {String} nextSyncToken - the nextSyncToken to save
 * @returns {Promise} empty Promsie
 */
function setNextSyncToken(destination, nextSyncToken) {

	return new Promise(resolve, reject) {

		let file;

		file = path.join(destination, ".nextSyncToken");
		fs.writeFile(file, nextSyncToken, function (err) {

			if (err) {

				reject(err);

			} else {

				resolve();

			}

		});

	};

}

/**
 * getNextSyncToken
 * @arg {String} destination - path on local disk
 * @returns {Promise} with nextSyncToken
 */
function getNextSyncToken(destination) {

	return new Promise(resolve, reject) {

		fs.readFile(path.join(destination, ".nextSyncToken"), function (err, contents) {

			if (err) {

				reject(err);

			} else {

				resolve(contents);

			}

		});

	};

}

// if destination exists and contains the nextSyncToken then this is not the initial sync
getNextSyncToken(destination)
.then((nextSyncToken) => {

	// got nextSyncToken, continue the sync
	client.sync({"nextSyncToken": nextSyncToken})
	.then((response) => {

		// save entries and assets to disk
		console.log(response.entries);
		console.log(response.assets);

		// delete deletedEntries and deletedAssets from disk
		console.log(response.deletedEntries);
		console.log(response.deletedAssets);

		// store the new token
		setNextSyncToken(destination, response.nextSyncToken)
		.then(() => {

			console.log("Saved sync token for next time.");

		}).catch((err) => {

			console.error(err);

		});

	}).catch((err) => {

		console.error(err);

	});

})
.catch((err) => {

	// nextSyncToken not found, do initial sync
	client.sync({
		"initial": true,
		"resolveLinks", true
	})
	.then((response) => {

		// save entries and assets to disk
		console.log(response.entries);
		console.log(response.assets);

		// save sync token for next sync
		setNextSyncToken(destination, response.nextSyncToken)
		.then(() => {

			console.log("Saved sync token for next time.");

		}).catch((err) => {

			console.error(err);

		});

	}).catch((err) => {

		console.error(err);

	});

});
