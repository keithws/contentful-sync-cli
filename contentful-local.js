/* eslint-disable no-console */
/*
 * module to provide a contentful like SDK to our local cache
 */
"use strict";

const path = require("path");
const fs = require("fs");
const glob = require("glob");

let clientResolveLinks, defaultLocale, localCachePath, locales, currentSpace;

const resolveLinksLimitMax = 10;

/**
 * sdk relies heavily on sys metadata
 * so we cannot omit the sys property on sdk level
 */
function normalizeSelect (query) {
    if (query.select && !/sys/i.test(query.select)) {
        query.select += ",sys";
    }
}


/**
 * fieldWithLocaleFallback
 */
function fieldWithLocaleFallback (field, value, preferredLocaleCode) {

    let newValue, locale;

    // get the locale record from the current metadata
    locale = locales.filter(l => l.code === preferredLocaleCode).shift();

    if (!locale) {
        throw new Error("Unknown locale: " + preferredLocaleCode);
    }

    if (locale.code in value) {
        newValue = value[locale.code];
    } else if (locale.fallbackCode) {
        newValue = fieldWithLocaleFallback(field, value, locale.fallbackCode);
    }

    return newValue;

}

/**
 * filter record by locale
 */
// TODO fallback locale list
function filterLocale(record, preferredLocaleCode) {

    let clone, field, locale;

    // get the locale record from the current metadata
    locale = locales.filter(l => l.code === preferredLocaleCode).shift();

    if (!locale) {
        throw new Error("Unknown locale: " + preferredLocaleCode);
    }

    // clone record
    clone = JSON.parse(JSON.stringify(record));

    if (clone.fields) {

        for (field in clone.fields) {
            if (clone.fields.hasOwnProperty(field)) {
                clone.fields[field] = fieldWithLocaleFallback(field, clone.fields[field], locale.code);
            }
        }

    }

    return clone;

}


/**
 * resolveLinks
 */
function resolveLinks (record, query) {
    return new Promise((resolve, reject) => {

        let fieldsWithLinks, promisesForRecords;

        // to avoid recursive loops, resolving links has a limit
        if (query.include > 0) {

            // find links in record fields
            if (record.fields) {

                // get a list of fields that are links or arrays of links
                fieldsWithLinks = Object.keys(record.fields).filter(key => {

                    if (Array.isArray(record.fields[key])) {
                        if (record.fields[key][0] && record.fields[key][0].sys) {
                            return record.fields[key][0].sys.type === "Link";
                        }
                    } else {
                        if (record.fields[key] && record.fields[key].sys) {
                            return record.fields[key].sys.type === "Link";
                        }
                    }

                });

                // get list of promises for the linked records
                promisesForRecords = fieldsWithLinks.map(key => {

                    let p, sys;

                    // switch on link type
                    sys = record.fields[key].sys;
                    switch(sys.linkType) {
                    case "Entry":
                        p = getEntry(sys.id, { "include": query.include - 1 });
                        break;
                    case "Asset":
                        p = getAsset(sys.id, { "include": query.include - 1 });
                        break;
                    default:
                        p = Promise.reject(
                            new Error("Unknown link type: %s", sys.linkType)
                        );
                        break;
                    }

                    return p;

                });

                // resolve promises and update record with linked records
                Promise.all(promisesForRecords).then(linkedRecords => {

                    fieldsWithLinks.forEach(key => {

                        if (Array.isArray(record.fields[key])) {

                            // field value has multiple links
                            record.fields[key] = linkedRecords.splice(0, record.fields[key].length);

                        } else {

                            // set the field to the current linked record
                            record.fields[key] = linkedRecords.shift();
                        }

                    });

                    resolve(record);

                }).catch(reject);


            } else {

                resolve(record);

            }

        } else {

            resolve(record);

        }

    });
}


/**
 * read file and optionally filter fields by locale
 */
// TODO filter by query
function readFileFilterLocale (file, query) {
    return new Promise((resolve, reject) => {

        fs.readFile(file, "utf8", function (err, data) {

            if (err) {
                reject(err);
            } else {

                let record = JSON.parse(data);

                getSpace(record)
                    .then(space => {
                        return new Promise((resolve) => {
                            // set default locale
                            locales = space.locales;
                            defaultLocale = locales.filter(locale => locale.default)[0];
                            resolve(defaultLocale);
                        });
                    })
                    .then(defaultLocale => {
                        return new Promise((resolve) => {
                            // filter to locale
                            record = filterLocale(record, query.locale || defaultLocale.code);

                            resolve(record);
                        });
                    })
                    .then(record => resolveLinks(record, query))
                    .then(resolve)
                    .catch(reject);

            }

        });
        
    });
}


/**
 * helper fuction to get the value of a nest property of an object by "path"
 * path is a string with property dot notation
 * i.e. "sys.createdAt" or "fields.image.title"
 */
function objectValueByPath(obj, path) {
    return path.split(".").reduce(function(acc, v) {
        return acc ? acc[v] : undefined;
    }, obj);
}


/**
 * sort fuction to sort arrays of objects by the value of the property
 * (possibly nested) refernced by the path string
 */
function compareObjectsByValueAtPath (path, reverve) {

    let direction = reverve ? -1 : 1;

    return function (a, b) {

        // get values
        let aValue = objectValueByPath(a, path);
        let bValue = objectValueByPath(b, path);

        // compare values and apply direction
        if (aValue > bValue) {
            return 1 * direction;
        } else if (aValue < bValue) {
            return -1 * direction;
        } else {
            return 0;
        }

    };

}


/**
 * sort item by order property in query
 * @arg {array} items to sort
 * @arg {query} query object
 * @returns {Promise<array>} a promise of an array of items
 */
function sortItemsByQuery (items, query) {
    return new Promise(resolve => {

        let order = query.order;

        if (order) {

            // sort items by order property in query
            // order property document here:
            // https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/search-parameters/order

            // split up multiple attributes by comma
            // and field name and decending or accending
            let attributes = order.split(",").map(attribute => {

                if (attribute.charAt(0) === "-") {
                    return {
                        "field": attribute.slice(1),
                        "reverse": true
                    };
                } else {
                    return {
                        "field": attribute,
                        "reverse": false
                    };
                }

            });

            // sort the items by the least specified attribute and repeat
            attributes.reverse().forEach(attribute => {

                items.sort(compareObjectsByValueAtPath(
                    attribute.field, attribute.reverse
                ));

            });

            resolve(items);

        } else {

            // no order specified, so just return the items
            resolve(items);

        }

    });
}

function readFilesAndFilter (dir, query) {
    return new Promise((resolve, reject) => {

        glob(path.join(dir, "**/*.json"), function (err, files) {

            if (err) {

                reject(err);

            } else {

                if (files && files.length > 0) {

                    Promise.all(
                        files.map(file => readFileFilterLocale(file, query))
                    )
                    .then(results => sortItemsByQuery(results, query))
                    .then(results => {
                        resolve({
                            "total": results.length,
                            "skip": 0,
                            "limit": Infinity,
                            "items": results
                        });
                    }).catch(reject);

                } else {

                    resolve({
                        "total": 0,
                        "skip": 0,
                        "limit": Infinity,
                        "items": []
                    });

                }

            }

        });

    });
}


/**
 * process query properties
 */
function processQueryProperties (query) {

    if (query.resolveLinks === undefined) {

        // use client setting if unset
        query.resolveLinks = clientResolveLinks;

    }

    if (query.resolveLinks === undefined) {

        // default to true for resolve links
        query.resolveLinks = true;

    }

    if (query.include === undefined) {

        // default to include one level of links
        query.include = 1;

    }

    if (query.include > resolveLinksLimitMax) {

        // limit the maximum number of inclusions
        query.include = resolveLinksLimitMax;

    }

    return query;

}


/**
 * Gets the Space which the client is currently configured to use
 * @memberof ContentfulClientAPI
 * @return {Promise<Entities.Space>} Promise for a Space
 * @example
 * client.getSpace()
 * .then(space => console.log(space))
 */
function getSpace () {
    return new Promise((resolve, reject) => {

        let file = path.resolve(localCachePath, currentSpace, "space.json");

        fs.readFile(file, "utf8", function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(JSON.parse(data));
            }
        });

    });
}


/**
 * Gets a Content Type
 * @memberof ContentfulClientAPI
 * @param  {string} id
 * @return {Promise<Entities.ContentType>} Promise for a Content Type
 * @example
 * client.getContentType('contentTypeId')
 * .then(contentType => console.log(contentType))
 */
function getContentType () {
    throw new Error("Not implemented.");
}


/**
 * Gets a collection of Content Types
 * @memberof ContentfulClientAPI
 * @param  {Object=} query - Object with search parameters. Check the <a href="https://www.contentful.com/developers/docs/javascript/tutorials/using-js-cda-sdk/#retrieving-entries-with-search-parameters">JS SDK tutorial</a> and the <a href="https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/search-parameters">REST API reference</a> for more details.
 * @return {Promise<Entities.ContentTypeCollection>} Promise for a collection of Content Types
 * @example
 * client.getContentTypes()
 * .then(contentTypes => console.log(contentTypes.items))
 */
function getContentTypes () {
    throw new Error("Not implemented.");
}


/**
 * Gets an Entry
 * @memberof ContentfulClientAPI
 * @param  {string} id
 * @param  {Object=} query - Object with search parameters. In this method it's only useful for `locale`.
 * @return {Promise<Entities.Entry>} Promise for an Entry
 * @example
 * client.getEntry('entryId')
 * .then(entry => console.log(entry))
 */
function getEntry (id, query = {}) {

    let dir, file;

    query = processQueryProperties(query);

    normalizeSelect(query);

    dir = path.resolve(localCachePath, currentSpace, "entries");
    if (query.content_type) {

        // limit to content type in query
        dir = path.resolve(dir, query.content_type);
        file = path.join(dir, `${query.content_type}_${id}.json`);

    } else {

        // search for id in all content types
        let pattern = `${dir}/**/*_${id}.json`;
        let files = glob.sync(pattern);
        if (files && files.length > 0) {

            file = files[0];

        }

    }

    return readFileFilterLocale(file, query);

}


/**
 * Gets a collection of Entries
 * @memberof ContentfulClientAPI
 * @param  {Object=} query - Object with search parameters. Check the <a href="https://www.contentful.com/developers/docs/javascript/tutorials/using-js-cda-sdk/#retrieving-entries-with-search-parameters">JS SDK tutorial</a> and the <a href="https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/search-parameters">REST API reference</a> for more details.
 * @param  {boolean=} query.resolveLinks - When true, links to other Entries or Assets are resolved. Default: true.
 * @return {Promise<Entities.EntryCollection>} Promise for a collection of Entries
 * @example
 * client.getEntries({content_type: 'contentTypeId'})
 * .then(entries => console.log(entries.items))
 */
function getEntries (query = {}) {

    let dir;

    query = processQueryProperties(query);

    dir = path.resolve(localCachePath, currentSpace, "entries");
    if (query.content_type) {

        // limit to content type in query
        dir = path.resolve(dir, query.content_type);

    }

    return readFilesAndFilter(dir, query);

}

function getAsset (id, query = {}) {

    query = processQueryProperties(query);

    normalizeSelect(query);
    let dir = path.resolve(localCachePath, currentSpace, "assets");
    return readFileFilterLocale(path.join(dir, `${id}.json`), query);

}

function getAssets (query = {}) {

    query = processQueryProperties(query);

    normalizeSelect(query);
    let dir = path.resolve(localCachePath, currentSpace, "assets");

    return readFilesAndFilter(dir, query);

}

function parseEntries () {
    throw new Error("Not implemented.");
}

function sync () {
    throw new Error("Not implemented.");
}


/**
 * unWrap - Contentful JSON to Plain JSON
 * @arg {Object} entry
 * @returns {Object} plain entry
 */
function unWrap (entry) {

    try {
        return Promise.resolve(unWrapSync(entry));
    } catch (err) {
        return Promise.reject(err);
    }

}


/**
 * unWrap without a promise
 */
function unWrapSync (entry) {

    let po;

    if (entry.items) {

        // return collections with thier items unWrapped
        entry.items = unWrapCollectionSync(entry);
        return entry;

    } else if (entry.fields) {

        po = Object.keys(entry.fields).reduce((acc, v) => {

            if (entry.fields[v] && entry.fields[v].sys) {

                acc[v] = unWrapSync(entry.fields[v]);

            } else {

                acc[v] = entry.fields[v];

            }

            return acc;

        }, {});

    }

    return po;

}


/**
 * unWrapCollectionSync - Contentful JSON Collection to Plain JSON Array
 * @arg {Object} records
 * @returns {Object} plain objects
 */
function unWrapCollectionSync (collection) {

    return collection.items.map(unWrapSync);

}


/**
 * unWrapCollection - Contentful JSON Collection to Plain JSON Array
 * @arg {Object} records
 * @returns {Promise<Object>} Promise of plain objects
 */
function unWrapCollection (collection) {

    try {
        return Promise.resolve(unWrapCollectionSync(collection));
    } catch (err) {
        return Promise.reject(err);
    }

}


function createClient (params = {}) {

    currentSpace = params.space;
    clientResolveLinks = params.resolveLinks;
    localCachePath = params.localPath;

    return {
        getSpace: getSpace,
        getContentType: getContentType,
        getContentTypes: getContentTypes,
        getEntry: getEntry,
        getEntries: getEntries,
        getAsset: getAsset,
        getAssets: getAssets,
        parseEntries: parseEntries,
        sync: sync,
        unWrap: unWrap,
        unWrapCollection: unWrapCollection
    };

}

module.exports = {
    createClient: createClient
};
