/* eslint-env node, mocha, should */
"use strict";

const should = require("should");
const contentful = require("contentful");

const client = contentful.createClient({
    accessToken: "b4c0n73n7fu1",
    space: "cfexampleapi"
});

describe("contentful-remote", function () {
    this.slow(200);
    this.timeout(800);

    describe("#getSpace()", function () {

        it("should get a Space which the client is currently configured to use", function (done) {

            client.getSpace().then(function (space) {
                should(space).be.an.Object;
                should(space).have.properties(["sys", "name", "locales"]);
                should(space.name).equal("Contentful Example API");
                done();
            }).catch(done);

        });

    });

    describe("#getEntry()", function () {

        it("should get an Entry", function (done) {

            client.getEntry("nyancat").then(function (entry) {

                should(entry).be.an.Object;
                should(entry).have.properties("sys", "fields");
                should(entry.fields.name).equal("Nyan Cat");
                entry.fields.color.should.be.equal("rainbow");
                done();

            }).catch(done);

        });

        it("should get an Entry in another locale", function (done) {

            client.getEntry("nyancat", { locale: "tlh" }).then(function (entry) {

                should(entry).be.an.Object;
                should(entry).have.properties("sys", "fields");
                should(entry.fields.name).equal("Nyan vIghro'");
                entry.fields.color.should.be.equal("rainbow");
                done();

            }).catch(done);

        });

        it("should return an error for an Entry to a unknown locale", function (done) {

            client.getEntry("nyancat", { locale: "asdf" })
                .then().catch(function (entry) {

                    should(entry).be.an.Object;
                    should(entry).have.properties("response");
                    should(entry.response).have.properties("data");
                    should(entry.response.data).have.properties("sys");
                    entry.response.data.sys.type.should.equal("Error");
                    entry.response.data.message.should.equal("Unknown locale: asdf");
                    done();

                });

        });

    });

    describe("#getEntries()", function () {

        it("should get a collection of Entries", function (done) {

            client.getEntries({ content_type: "cat" }).then(function (entries) {

                should(entries).be.an.Object;
                should(entries).have.properties("items");
                should(entries.items).be.an.Array;
                should(entries.items).have.length(3);
                done();

            }).catch(done);

        });

    });

    describe("#getAsset()", function () {

        it("should get an Asset", function () {

            return client.getAsset("nyancat").should.eventually.be.an.Object;

        });

    });

    describe("#getAssets()", function () {

        it("should get a collection of Assets", function () {

            return client.getAssets().should.eventually.be.an.Object;

        });

    });

});
