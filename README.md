# contentful-sync-cli

Command line program to sync Contentful data to local files on disk. Data is stored in JSON format.

## Install

```bash
npm install -g contentful-sync-cli
```

## Command Usage

Use of the Contentful Sync API requires an access token from Contentful. It should be stored in the `CONTENTFUL_ACCESS_TOKEN` environment variable.

```bash

	CONTENTFUL_ACCESS_TOKEN=b4c0n73n7fu1
	mkdir /tmp/contentful-data-cfexampleapi
	cd /tmp/contentful-data-cfexampleapi
	contentful-sync fetch cfexampleapi

```
The current working directory will be populated with the assets and entries from the specified space grouped by content type. Each asset and entry will occupy one file. Each entry will be saved in JSON.

The environment variable containing the Contentful Acces Token may be added to your shell profile.

Run `contentful-sync --help` for more details.

```bash
  Usage: contentful-sync [options] [command]


  Commands:

    fetch <space> [destination]  Fetch content from a space with the Contentful Sync API

  Options:

    -h, --help                         output usage information
    -V, --version                      output the version number
    -q, --quiet                        Progress is not reported to the standard error stream.
    -v, --verbose                      Be verbose.
    -a, --access-token <token>         Contentful Access Token
    -i, --initial                      Fetch everything instead of fetching only what has changed.
    -r, --resolve-links <boolean>      Resolve links to other entries and assets.
    -t, --type <type>                  What to sync: all (default), Asset, Entry, Deletion, DeletedAsset, or DeletedEntry
    -c, --content-type <content-type>  Limit sync to entries of specified content type. Implies --type Entry

```

## Library Usage

```js

	const contentfulSync = require('contentful-sync-cli');
	
	let options = {
		"accessToken": process.env.CONTENTFUL_ACCESS_TOKEN,
		"space": "cfexampleapi",
		"destination": "/tmp/contentful-data-cfexampleapi"
	};
	
	contentfulSync.fetch(options)
	.then(() => {
	
		console.log("Saved data to %s", options.destination);
	
	})
	.catch((err) => {
	
		console.log(err);
	
	});

```

## Options

```js
{
	"space": null, // ID of the space you want to sync
	"destination": null, // where to save the data files
	"accessToken": null, // your acces token
	"initial": null, // set to true to delete local data files and sync
	"resolveLinks": true, // links from entries to other entries and assets will also be resolved
	"type": "all", // OR Asset, Entry, Deletion, DeletedAsset, or DeletedEntry
	"content_type": null, // type must be Entry
}
```

## Todo

* add tests
* save assets to disk
* delete deletedAssets from disk
* add command line option to limit entries to one locale
* a progress indicator

## Change Log

_January 19, 2017 – v1.0.2_

* fixed bug when syncing a deleted entry

_October 26, 2016 – v1.0.1_

* fixed bug when saving updates to specified path

_October 20, 2016 – v1.0.0_

* call sync api
* save sync token
* load sync token and continue the sync on subsequent requests
* create readme
* turn index.js into a module
* create bin script and require index.js module
* create `fetch` sub-command
* parse command line options and merge with environment variables
* save entries to disk
* delete deletedEntries from disk
