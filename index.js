"use strict";

const fs = require("fs");
const path = require("path");
const contentful = require("contentful");
const async = require("async");
const mkdirp = require("mkdirp");
const glob = require("glob");


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
 * unContentful - Contentful JSON to Plain JSON
 * @arg {Object} entry
 * @returns {Object} plain entry
 */
function unContentful (entry, locale) {

    return Object.keys(entry.fields).reduce((p, c) => {

        if (entry.fields[c][locale] && entry.fields[c][locale].sys) {

            p[c] = entry.fields[c][locale].sys;

        } else {

            p[c] = entry.fields[c][locale];

        }

        return p;

    }, {});

}


/**
 * getFilePathForEntry
 * @arg {Object} entry
 * @returns {String} file path for entry
 */
function getFilePathForEntry (entry, destination) {

    let contentType, file, id, pattern;

    id = entry.sys.id;
    if (entry.sys.type === "DeletedEntry") {

        // deleted entries do not provide the content type
        // therefore must check all contentType directories
        contentType = "*";
        pattern = path.resolve(destination, "entries", contentType, `${contentType}_${id}.json`);
        file = glob.sync(pattern)[0];

    } else {

        contentType = entry.sys.contentType.sys.id;
        file = path.join(destination, "entries", contentType, `${contentType}_${id}.json`);

    }

    return file;
}


/**
 * saveEntriesToDisk
 * @arg {Object} entires
 * @returns {Promise}
 */
function saveEntriesToDisk (entries, destination) {

    return new Promise((resolve, reject) => {

        if (entries) {

            // TODO get actual locale
            let locale = "en-US";

            async.each(entries, (entry, callback) => {

                let data, file;

                // create file path to save entry to
                file = getFilePathForEntry(entry, destination);

                // ensure path exists
                mkdirp.sync(path.dirname(file));

                // get a normal JSON object
                data = unContentful(entry, locale);
                fs.writeFile(file, JSON.stringify(data, null, 4), callback);

            }, (err) => {

                if (err) {

                    reject(err);

                } else {

                    resolve();

                }

            });

        }

    });

}


/**
 * saveAssetsToDisk
 * @arg {Object} assets
 * @returns {Promise}
 */
function saveAssetsToDisk (assets) {

    return new Promise((resolve, reject) => {

        if (assets) {

            assets.forEach((asset) => {

                asset.foo = "bar";

            });

        }

        resolve();

    });

}


/**
 * deleteEntriesFromDisk
 * @arg {Object} entires
 * @returns {Promise}
 */
function deleteEntriesFromDisk (entries, destination) {

    return new Promise((resolve, reject) => {

        if (entries) {

            async.each(entries, (entry, callback) => {

                let file;

                // create file path to save entry to
                file = getFilePathForEntry(entry, destination);

                // safely ignore non-existant files
                if (file) {
                    fs.unlink(file, callback);
                } else {
                    callback();
                }

            }, (err) => {

                if (err) {

                    reject(err);

                } else {

                    resolve();

                }

            });

        }

    });

}


/**
 * deleteAssetsFromDisk
 * @arg {Object} assets
 * @returns {Promise}
 */
function deleteAssetsFromDisk (assets) {

    return new Promise((resolve, reject) => {

        if (assets) {

            assets.forEach((asset) => {

                console.dir({ "deletedAsset": asset });

            });

        }

        resolve();

    });

}


/**
 * initialSync - sync everyting
 */
function initialSync (options) {

    return new Promise((resolve, reject) => {

        var client = getClient(options);

        // warn about upstream bug
        if (options.type !== "all") {

            throw new Error("An upstream bug in the contentful.js SDK prevents limiting the type on the initial sync.");

        }

        // nextSyncToken not found, do initial sync
        client.sync({
            "initial": true,
            "resolveLinks": false,
            /* specifing the type appears to trigger an upstream bug
             * see https://github.com/contentful/contentful.js/issues/110
             * "type": options.type,
             * "content_type": options.contentType
             */
        })
        .then((response) => {

            const po = response.toPlainObject();

            console.log("New content: %d entries, %d assets", po.entries.length, po.assets.length);

            // save entries and assets to disk
            // and delete deletedEntries and deletedAssets from disk
            Promise.all([
                saveEntriesToDisk(po.entries, options.destination),
                saveAssetsToDisk(po.assets, options.destination)
            ])
            .then((results) => {

                // store the new token
                setNextSyncToken(options.destination, response.nextSyncToken)
                .then(() => {

                    console.log("Saved sync token for next time.");
                    resolve(results);

                }).catch(reject);

            })
            .catch(reject);

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

                    const po = response.toPlainObject();

                    console.log("New and updated content: %d entries, %d assets", po.entries.length, po.assets.length);
                    console.log("        Deleted content: %d entries, %d assets", po.deletedEntries.length, po.deletedAssets.length);

                    // save entries and assets to disk
                    // and delete deletedEntries and deletedAssets from disk
                    Promise.all([
                        saveEntriesToDisk(po.entries, options.destination),
                        saveAssetsToDisk(po.assets, options.destination),
                        deleteEntriesFromDisk(po.deletedEntries, options.destination),
                        deleteAssetsFromDisk(po.deletedAssets, options.destination)
                    ])
                    .then((results) => {

                        // store the new token
                        setNextSyncToken(options.destination, response.nextSyncToken)
                        .then(() => {

                            console.log("Saved sync token for next time.");
                            resolve(results);

                        }).catch(reject);

                    })
                    .catch(reject);

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
