# cordova-plugin-asset-downloader
Cordova plugin to download a List of files or a single file to the Phone, check consistency(Android and ios)
no `cordova-file-transfer` dependency. `cordova-file-transfer` was recently [depreciated](https://cordova.apache.org/blog/2017/10/18/from-filetransfer-to-xhr2.html).

Inspired by `cordova-plugin-fastrde-downloader` but with less features.

## Compatibility

- Android 4.4+
- iOS 10+
- Cordova 5.0+

## Installation
```
cordova plugin add https://github.com/victorsoftart/cordova-plugin-asset-downloader
```

This will also install `cordova-plugin-file` if not already installed.

## Usage

### Initialize the downloader

```javascript
AssetDownloader.init({baseUrl: "yourServerBaseUrl", folder: "yourPersistantAppFolder", fileSystem: "storeDownloadsFileSystem"});
```
options:

- **baseUrl**: server base url to downloads [required]
- **folder**: folder to store downloads in [required]
- **fileSystem**: fileSystem to store downloads in (use cordova.file.* to be platform independent)
- **delete**: *true* -> delete a file or folder [default: *true*]
- **wifiOnly**: *true* -> only Download when connected to Wifi, else fires ``DOWNLOADER_noWifiConnection`` event [default: *false*]

### Download single file

```javascript
AssetDownloader.getAsset("http://yourhost.de/some.zip");
```

### Download multiple files

```javascript
AssetDownloader.getMultipleAssets([
  {url:"http://yourhost.de/some1.zip"},
  {url:"http://yourhost.de/some2.zip"},
  {url:"http://yourhost.de/some3.zip"}
]);
```
### Abort download in progress
You have to re-init downloader after aborting an transfer

```javascript
AssetDownloader.abort();
```

### Events
```javascript
document.addEventListener(eventName, function(event){
  var data = event.data;
});

eventNames:
DOWNLOADER_initialized        data:none
DOWNLOADER_gotFileSystem      data:[cordova.fileSystem fileSystem]
DOWNLOADER_gotFolder          data:[cordova.fileEntry folder]
DOWNLOADER_error              data:[object error]
DOWNLOADER_noWifiConnection   data:none
DOWNLOADER_downloadSuccess    data:[cordova.fileEntry entry]
DOWNLOADER_downloadError      data:[object error]
DOWNLOADER_downloadProgress   data:[number percentage, string fileName]
DOWNLOADER_fileRemoved        data:[cordova.fileEntry entry]
DOWNLOADER_fileRemoveError    data:[cordova.fileEntry entry]
DOWNLOADER_getFileError       data:[object error]
```

## Full Examples

### Download file some.txt to folder downloads
```javascript
AssetDownloader.init({folder: "downloads"});
AssetDownloader.getAsset("http://yourhost.de/some.txt");
```

### Download file abort.zip and abort download, the download another.zip
```javascript
AssetDownloader.init({folder: "downloads"});
AssetDownloader.getAsset("http://yourhost.de/abort.zip");
AssetDownloader.abort();
AssetDownloader.init({folder: "downloads"});
AssetDownloader.getAsset("http://yourhost.de/another.zip");
```

### Download multiple files to downloads
```javascript
AssetDownloader.init({folder: "downloads"});
AssetDownloader.getMultipleFiles([
  {url: "http://yourhost.de/some1.zip", md5:"1f4ea2219aa321ef5cd3143ea33076ac"},
  {url: "http://yourhost.de/some2.zip", md5:"2f4ea2219aa321ef5cd3143ea33076ad"},
  {url: "http://yourhost.de/some3.zip", md5:"3f4ea2219aa321ef5cd3143ea33076ae"}
]);
```
