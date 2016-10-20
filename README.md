# contentful-sync-cli

Command line program to sync Contentful data to local files on disk. Data is stored in JSON format.

## Install

```bash
npm install -g contentful-sync-cli
```

## Command Usage



## Library Usage

```js

	const sync = require('contentful-sync-cli');
	
	let options = {
		"space": "cfexampleapi",
		"accessToken": "b4c0n73n7fu1",
		"destination": "/tmp/contentful-data-cfexampleapi"
	};
	
	sync(options)
	.then(() => {
	
		console.log("Saved data to %s", destination);
	
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

* turn index.js into a module
* create bin script and require index.js module
* parse command line options and merge with environment variables
* save entries and assets to disk
* delete deletedEntries and deletedAssets from disk

## Change Log

_October 19, 2016 – v1.0.0_

* call sync api
* save sync token
* load sync token and continue the sync on subsequent requests
* create readme
