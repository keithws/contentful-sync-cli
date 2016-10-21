# contentful-sync-cli

Command line program to sync Contentful data to local files on disk. Data is stored in JSON format.

## Install

```bash
npm install -g contentful-sync-cli
```

## Command Usage

```bash

	CONTENTFUL_ACCESS_TOKEN=b4c0n73n7fu1
	mkdir /tmp/contentful-data-cfexampleapi
	cd /tmp/contentful-data-cfexampleapi
	contentful-sync fetch cfexampleapi

```
The current working directory will be populated with the assets and entries from the specified space grouped by content type. Each asset and entry will occupy one file. Each entry will be saved in JSON.

The environment variable containing the Contentful Acces Token can and should be added to your shell profile.

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
		"accessToken": "b4c0n73n7fu1",
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

* save assets to disk
* real progress indicator
* delete deletedAssets from disk
* lookup default locale for space instead of hardcoding to en-US
* add support for multiple locales

## Change Log

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
