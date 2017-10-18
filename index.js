/* eslint-env node */

"use strict";

const fs = require("graceful-fs");
const path = require("path");
const contentful = require("contentful");
const mkdirp = require("mkdirp");
const glob = require("glob");
const HttpsProxyAgent = require("https-proxy-agent");

var agent;
const proxy = process.env.npm_config_https_proxy || process.env.npm_config_proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
    agent = new HttpsProxyAgent(proxy);
}

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

    return contentful.createClient({
        "space": options.space,
        "accessToken": options.accessToken,
        "agent": agent,
        "host": options.host
    });

}


/**
 * getFilePath
 * @arg {Object} record
 * @returns {String} file path for record
 */
function getFilePath (record, destination) {
    return new Promise((resolve, reject) => {

        let contentType, id, pattern;

        id = record.sys.id;
        switch (record.sys.type) {
        case "DeletedEntry":

            // deleted entries do not provide the content type
            // therefore must check all contentType directories
            contentType = "*";
            pattern = path.resolve(destination, "entries", contentType, `${contentType}_${id}.json`);
            glob(pattern, (err, files) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(files);
                }
            });
            break;

        case "Entry":

            contentType = record.sys.contentType.sys.id;
            resolve([
                path.join(destination, "entries", ".all", `${id}.json`),
                path.join(destination, "entries", contentType, `${contentType}_${id}.json`)
            ]);
            break;

        case "DeletedAsset":

            resolve([path.join(destination, "assets", `${id}.json`)]);
            break;

        case "Asset":

            resolve([path.join(destination, "assets", `${id}.json`)]);
            break;

        }

    });

}


/**
 * saveToDisk
 * @arg {Object} entries or assets
 * @returns {Promise}
 */
function saveToDisk (records, destination) {

    if (records) {

        return Promise.all(records.map(record => {

            // generate file paths
            return getFilePath(record, destination)
            .then(files => {

                // create directories
                return Promise.all(files.map(file => {
                    return new Promise((resolve, reject) => {
                        mkdirp(path.dirname(file), err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(file);
                            }
                        });
                    });
                }));

            })
            .then(files => {

                // write files to disk
                return Promise.all(files.map(file => {
                    return new Promise((resolve, reject) => {
                        fs.writeFile(file, JSON.stringify(record, null, 4), err => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(file);
                            }
                        });
                    });
                }));

            })
            .then(files => {

                // push the results back into an array
                return Promise.all(files.map((file, index) => {
                    return Promise.resolve({
                        "data": records[index],
                        "file": file
                    });
                }));

            });

        }));

    } else {

        return Promise.resolve();

    }

}


/**
 * deleteFromDisk
 * @arg {Object} entires
 * @returns {Promise}
 */
function deleteFromDisk (records, destination) {

    if (records) {

        return Promise.all(records.map(record => {

            // get paths where the record is saved
            return getFilePath(record, destination)
            .then(files => {
                return Promise.all(files.map(file => {

                    // safely ignore non-existant files
                    if (file) {
                        return new Promise((resolve, reject) => {
                            fs.unlink(file, err => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    } else {
                        return Promise.resolve();
                    }
                }));
            });

        }));

    } else {

        return Promise.resolve();

    }

}


/**
 * get metadata for space and save to disk
 */
function getSpace(client, dir) {
    return new Promise((resolve, reject) => {

        // fetch metadata for space and save for later
        client.getSpace().then(space => {

            let file = path.join(dir, "space.json");

            mkdirp(dir, function (err) {
                if (err) {
                    reject(err);
                } else {
                    fs.writeFile(file, JSON.stringify(space, null, 4), function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                }
            });

        }).catch(reject);

    });

}


/**
 * initialSync - sync everyting
 */
function initialSync (options) {

    return new Promise((resolve, reject) => {

        // warn about upstream bug
        if (options.type !== "all") {

            throw new Error("An upstream bug in the contentful.js SDK prevents limiting the type on the initial sync.");

        }

        var client = getClient(options);

        // do initial sync
        Promise.all([
            getSpace(client, options.destination),
            client.sync({
                "initial": true,
                "resolveLinks": false
                /* specifing the type appears to trigger an upstream bug
                 * see https://github.com/contentful/contentful.js/issues/110
                 * "type": options.type,
                 * "content_type": options.contentType
                 */
            })
        ]).then(results => {

            let response = results[1];
            const po = response.toPlainObject();

            // save entries and assets to disk
            // and delete deletedEntries and deletedAssets from disk
            Promise.all([
                saveToDisk(po.entries, options.destination),
                saveToDisk(po.assets, options.destination)
            ])
            .then((results) => {

                // store the new token
                setNextSyncToken(options.destination, response.nextSyncToken)
                .then(() => {

                    resolve({
                        "entries": results[0],
                        "assets": results[1]
                    });

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
function fetch (arguementOptions) {

    return new Promise((resolve, reject) => {

        // set default options
        let defaultOptions = {
            "destination": ".",
            "resolveLinks": true,
            "type": "all",
            "host": process.env.NODE_ENV === "production" ? "cdn.contentful.com" : "preview.contentful.com"
        };

        // create options by mising defaults with arguements
        let options = {};
        Object.assign(options, defaultOptions, arguementOptions);

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

                    // save entries and assets to disk
                    // and delete deletedEntries and deletedAssets from disk
                    Promise.all([
                        saveToDisk(po.entries, options.destination),
                        saveToDisk(po.assets, options.destination),
                        deleteFromDisk(po.deletedEntries, options.destination),
                        deleteFromDisk(po.deletedAssets, options.destination)
                    ])
                    .then((results) => {

                        // store the new token
                        setNextSyncToken(options.destination, response.nextSyncToken)
                        .then(() => {

                            resolve({
                                "entries": results[0],
                                "assets": results[1],
                                "deletedEntries": results[2],
                                "deletedAssets": results[3]
                            });

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
