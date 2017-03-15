/* eslint-env node, mocha, should */
"use strict";

const should = require("should");
const contentful = require("../contentful-local");

/* eslint-disable no-console */
const client = contentful.createClient({
    space: "cfexampleapi",
    localPath: "/tmp/contentful-data"
});

describe("contentful-local", function () {

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

        it("should get an Entry and resolve links one level deep", function (done) {

            client.getEntry("nyancat").then(function (entry) {

                entry.fields.bestFriend.should.have.properties("sys", "fields");
                entry.fields.bestFriend.fields.name.should.equal("Happy Cat");
                done();

            }).catch(done);

        });

        it("should get an Entry in another locale", function (done) {

            client.getEntry("nyancat", { locale: "tlh" }).then(function (entry) {

                should(entry).be.an.Object;
                should(entry).have.properties("sys", "fields");
                should(entry.fields.name).equal("Nyan vIghro\'");
                entry.fields.color.should.be.equal("rainbow");
                done();

            }).catch(done);

        });

        it("should return an error for an Entry to a unknown locale", function () {

            let invalidLocale = "asdf";
            let promise = client.getEntry("nyancat", {
                "locale": invalidLocale
            });
            return promise.should.be.rejectedWith({
                "message": `Unknown locale: ${invalidLocale}`
            });

        });

    });

    describe("#getEntry(..., { include: n })", function () {

        it("should return an Entry with one level of resolved links by default", function (done) {

            client.getEntry("nyancat")
                .then(client.unWrap)
                .then(function (po) {

                    should(po).be.an.Object;
                    should(po).have.properties("name", "likes", "color", "bestFriend", "birthday", "lives", "image");
                    should(po.bestFriend.name).equal("Happy Cat");
                    should.not.exist(po.bestFriend.bestFriend);
                    done();

                })
                .catch(done);

        });

        it("should return an Entry with two levels of resolved links", function (done) {

            client.getEntry("nyancat", { "include": 2 })
                .then(client.unWrap)
                .then(function (po) {

                    should(po).be.an.Object;
                    should(po).have.properties("name", "likes", "color", "bestFriend", "birthday", "lives", "image");
                    should(po.bestFriend.name).equal("Happy Cat");
                    should.exist(po.bestFriend.bestFriend);
                    should(po.bestFriend.bestFriend.name).equal("Nyan Cat");
                    done();

                })
                .catch(done);

        });

        it("should return an Entry with at most ten levels of resolved links", function (done) {

            client.getEntry("nyancat", { "include": 11 })
                .then(client.unWrap)
                .then(function (po) {

                    should(po).be.an.Object;
                    should(po).have.properties("name", "likes", "color", "bestFriend", "birthday", "lives", "image");
                    should(po.bestFriend.name).equal("Happy Cat");
                    should.exist(po.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend);
                    should(po.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.bestFriend.name).equal("Nyan Cat");
                    done();

                })
                .catch(done);

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

        it("should get a collection of Entries in the order specified", function (done) {

            client.getEntries({ content_type: "cat", order: "sys.createdAt" }).then(function (entries) {

                should(entries).be.an.Object;
                should(entries).have.properties("items");
                should(entries.items).be.an.Array;
                should(entries.items).have.length(3);
                should(entries.items[0].sys.id).equal("nyancat");
                should(entries.items[1].sys.id).equal("happycat");
                should(entries.items[2].sys.id).equal("garfield");
                done();

            }).catch(done);

        });

        it("should get a collection of Entries in the reverse order specified", function (done) {

            client.getEntries({ content_type: "cat", order: "-fields.color" }).then(function (entries) {

                should(entries).be.an.Object;
                should(entries).have.properties("items");
                should(entries.items).be.an.Array;
                should(entries.items).have.length(3);
                should(entries.items[0].fields.color).equal("rainbow");
                should(entries.items[1].fields.color).equal("orange");
                should(entries.items[2].fields.color).equal("gray");
                done();

            }).catch(done);

        });

        it("should get a collection of Entries in the multiple orders specified", function (done) {

            client.getEntries({ content_type: "cat", order: "sys.entry,-fields.lives" }).then(function (entries) {

                should(entries).be.an.Object;
                should(entries).have.properties("items");
                should(entries.items).be.an.Array;
                should(entries.items).have.length(3);
                should(entries.items[0].fields.lives).equal(1337);
                should(entries.items[1].fields.lives).equal(9);
                should(entries.items[2].fields.lives).equal(1);
                done();

            }).catch(done);

        });

        it("should get a collection of Entries even when order specifies an unorderable property", function (done) {

            client.getEntries({ content_type: "cat", order: "fields.image" }).then(function (entries) {

                should(entries).be.an.Object;
                should(entries).have.properties("items");
                should(entries.items).be.an.Array;
                should(entries.items).have.length(3);
                should(entries.items[0].sys.id).equal("garfield");
                should(entries.items[1].sys.id).equal("happycat");
                should(entries.items[2].sys.id).equal("nyancat");
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

    describe("#unWrap()", function () {

        it("should return a plain JS object from an Entry", function (done) {

            client.getEntry("nyancat")
                .then(client.unWrap)
                .then(function (po) {

                    should(po).be.an.Object;
                    should(po).have.properties("name", "likes", "color", "bestFriend", "birthday", "lives", "image");
                    should(po.name).equal("Nyan Cat");
                    done();

                })
                .catch(done);

        });

        it("should return a plain JS object from an Asset", function (done) {

            client.getAsset("nyancat")
                .then(client.unWrap).then(function (po) {

                    should(po).be.an.Object;
                    should(po).have.properties("title", "file");
                    should(po.title).equal("Nyan Cat");
                    done();

                })
                .catch(done);

        });

    });

    describe("#unWrapCollection()", function () {

        it("should return an array of plain JS objects from an EntryCollection", function (done) {

            client.getEntries()
                .then(client.unWrapCollection).then(function (arr) {

                    should(arr).be.an.Array;
                    should(arr).have.length(10);
                    done();

                })
                .catch(done);

        });

        it("should return an array of plain JS objects from an AssetCollection", function (done) {

            client.getAssets()
                .then(client.unWrapCollection).then(function (arr) {

                    should(arr).be.an.Array;
                    should(arr).have.length(5);
                    arr[0].title.should.be.equal("Doge");
                    done();

                })
                .catch(done);

        });

    });

});
