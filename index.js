"use strict";

const fs = require("fs");
const path = require("path");

const contentful = require("contentful");

/**
 * setNextSyncToken
 * @arg {String} destination - path on local disk
 * @arg {String} nextSyncToken - the nextSyncToken to save
 * @returns {Promise} empty Promsie
 */
function setNextSyncToken(destination, nextSyncToken) {

    return new Promise((resolve, reject) => {

        let file;

        file = path.join(destination, ".nextSyncToken");
        fs.writeFile(file, nextSyncToken, function (err) {

            if (err) {

                reject(err);

            } else {

                resolve();

            }

        });

    });

}

/**
 * getNextSyncToken
 * @arg {String} destination - path on local disk
 * @returns {Promise} with nextSyncToken
 */
function getNextSyncToken(destination) {

    return new Promise((resolve, reject) => {

        fs.readFile(path.join(destination, ".nextSyncToken"), function (err, contents) {

            if (err) {

                reject(err);

            } else {

                resolve(contents);

            }

        });

    });

}


/**
 * getClient - create Contentful client
 */
function getClient(options) {

    var client = contentful.createClient({
        "space": options.space,
        "accessToken": options.accessToken
    });

    return client;
}


/**
 * initialSync - sync everyting
 */
function initialSync (options) {

    return new Promise((resolve, reject) => {

        var client = getClient(options);

        // nextSyncToken not found, do initial sync
        client.sync({
            "initial": true,
            "resolveLinks": options.resolveLinks,
            "type": options.type,
            "content_type": options.contentType
        })
        .then((response) => {

            // save entries and assets to disk
            console.log(response.entries);
            console.log(response.assets);

            // save sync token for next sync
            setNextSyncToken(options.destination, response.nextSyncToken)
            .then(() => {

                console.log("Saved sync token for next time.");
                resolve(response);

            }).catch(reject);

        }).catch(reject);

    });

}


/**
 * fetch - sync content from space to files
 * @arg {Object} options
 * @returns {Promise} the promise of success or failure
 */
function fetch (options) {

    return new Promise((resolve, reject) => {

        // option check
        // type must be Entry if Content Type is specified
        if (options.contentType) {

            options.type = "Entry";

        }

        // always perform initial sync if reqeuested
        if (options.initial) {

            initialSync(options).then(resolve).catch(reject);

        } else {

            // if destination exists and contains the nextSyncToken then this is not the initial sync
            getNextSyncToken(options.destination)
            .then((nextSyncToken) => {

                var client = getClient(options);

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
                    setNextSyncToken(options.destination, response.nextSyncToken)
                    .then(() => {

                        console.log("Saved sync token for next time.");
                        resolve(response);

                    }).catch(reject);

                }).catch(reject);

            })
            .catch((err) => {

                // check for expected "No Entry" error
                if (err && err.code && err.code === "ENOENT") {

                    initialSync(options).then(resolve).catch(reject);

                } else {

                    reject(err);

                }

            });

        }

    });

}

module.exports = {
    "fetch": fetch
};
