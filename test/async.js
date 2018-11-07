/* eslint-env node, mocha, should */
"use strict";

const contentfulSync = require("..");
const should = require("should");
const rimraf = require("rimraf");
const http = require("http");
const setup = require("proxy");


/* use contentful Preview sample space and access token for tests */
let options = {
    "accessToken": "e5e8d4c5c122cf28fc1af3ff77d28bef78a3952957f15067bbc29f2f0dde0b50",
    "space": "cfexampleapi",
    "destination": "/tmp/contentful-data/cfexampleapi"
};


describe("contentful-sync", function () {
    this.slow(400);
    this.timeout(1600);

    beforeEach(function (done) {

        rimraf(options.destination, done);

    });

    describe("#fetch({ initial: true })", function () {

        it("should populate destination with JSON files", function (done) {

            options.initial = true;
            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.entries).have.length(10);

                should(response.assets).be.an.Array;
                should(response.assets).have.length(5);

                done();

            }).catch(done);

        });

    });

    describe("#fetch()", function () {

        it("should only sync deltas", function (done) {

            options.initial = true;
            contentfulSync.fetch(options).then(function () {

                options.initial = false;
                contentfulSync.fetch(options).then(function (response) {

                    should(response).have.property("entries");
                    should(response).have.property("assets");
                    should(response).have.property("deletedEntries");
                    should(response).have.property("deletedAssets");

                    should(response.entries).be.an.Array;
                    should(response.assets).be.an.Array;
                    should(response.deletedEntries).be.an.Array;
                    should(response.deletedAssets).be.an.Array;

                    should(response.entries).be.empty;
                    should(response.assets).be.empty;
                    should(response.deletedEntries).be.empty;
                    should(response.deletedAssets).be.empty;
                    done();

                }).catch(done);

            }).catch(done);

        });

        it("should sync from the Preview API when NODE_ENV=", function (done) {

            options.initial = true;
            process.env.NODE_ENV = "";
            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.assets).be.an.Array;

                // check entry that is different between Preview and Delivery APIs
                should(response.assets).be.an.Array;
                should(response.assets).have.length(5);

                done();

            }).catch(done);

        });

    });

    describe("#fetch() via an HTTP proxy", function () {

        let server;

        before(function (done) {

            // setup proxy
            server = setup(http.createServer());
            server.listen(3128, function () {

                var port = server.address().port;

                process.env.HTTPS_PROXY = `http://localhost:${port}/`;

                done();

            });

        });

        after(function (done) {

            // remove proxy config
            delete process.env.HTTPS_PROXY;

            // tear down proxy
            server.close();
            done();

        });

        it("should populate destination with JSON files", function (done) {

            options.initial = true;

            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.entries).have.length(10);

                should(response.assets).be.an.Array;
                should(response.assets).have.length(5);

                done();

            }).catch(done);

        });

    });

    describe("#fetch() in production", function () {

        /* use Content Delivery API sample space and access token for this test */
        before(function () {

            options.accessToken = "b4c0n73n7fu1";
            options.host = "cdn.contentful.com";

        });

        after(function () {

            options.accessToken = "e5e8d4c5c122cf28fc1af3ff77d28bef78a3952957f15067bbc29f2f0dde0b50";
            delete options.host;

        });

        it("should sync from the Delivery API when options.host = cdn.contentful.com", function (done) {

            options.host = "cdn.contentful.com";
            options.initial = true;
            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.assets).be.an.Array;

                // check entry that is different between Preview and Delivery APIs
                should(response.assets).be.an.Array;
                should(response.assets).have.length(4);

                done();

            }).catch(done);

        });


        it("should sync from the Delivery API when NODE_ENV=production", function (done) {

            /* use Content Delivery API sample space and access token for this test */

            delete options.host;
            process.env.NODE_ENV = "production";
            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.assets).be.an.Array;

                // check entry that is different between Preview and Delivery APIs
                should(response.assets).be.an.Array;
                should(response.assets).have.length(4);

                delete process.env.NODE_ENV;
                options.host = "cdn.contentful.com";

                done();

            }).catch(done);

        });

    });

});
