/* eslint-env node, mocha, should */
"use strict";

const contentfulSync = require("..");
const should = require("should");
const rimraf = require("rimraf");


/* use contentful sample space and access token for tests */
let options = {
    "accessToken": "b4c0n73n7fu1",
    "space": "cfexampleapi",
    "destination": "/tmp/contentful-data/cfexampleapi"
};


describe("contentful-sync", function () {
    this.slow(400);
    this.timeout(1600);

    before(function (done) {

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
                should(response.assets).have.length(4);

                done();

            }).catch(done);

        });

    });

    describe("#fetch()", function () {

        it("should only sync deltas", function (done) {

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

        });

        it("should sync from the Delivery API when NODE_ENV=production", function (done) {

            options.initial = true;
            process.env.NODE_ENV = "production";
            contentfulSync.fetch(options).then(function (response) {

                should(response).have.property("entries");
                should(response).have.property("assets");

                should(response.entries).be.an.Array;
                should(response.assets).be.an.Array;

                // check entry that is different between Preview and Delivery APIs
                // TODO
                done();

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
                // TODO
                done();

            }).catch(done);

        });

    });

});
