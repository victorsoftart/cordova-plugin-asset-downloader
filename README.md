# cordova-plugin-asset-downloader
Cordova plugin to download a List of files or a single file to the Phone, check consistency(Android and iOS).

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
- **wifiOnly**: *true* -> only Download when connected to Wifi, else fires ``DOWNLOADER_noWifiConnection`` event [default: *false*]

### Download single file
```javascript
AssetDownloader.getAsset("/assets/some.png");
```

### Download multiple files
```javascript
AssetDownloader.getMultipleAssets([
  {url: "/assets/some1.png"},
  {url: "/assets/some2.png"},
  {url: "/assets/some3.png"}
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
DOWNLOADER_fetchSuccess       data:[assetUrl]
DOWNLOADER_fetchError         data:[assetUrl, object error]
DOWNLOADER_removeSuccess      data:[cordova.fileEntry entry]
DOWNLOADER_removeError        data:[cordova.fileEntry entry]
DOWNLOADER_removeFileGetError data:[object error]
DOWNLOADER_fileRemoved        data:[cordova.fileEntry entry]
DOWNLOADER_fileRemoveError    data:[cordova.fileEntry entry]
DOWNLOADER_getFileError       data:[object error]
DOWNLOADER_folderRemoved      data:[cordova.fileEntry entry]
DOWNLOADER_folderRemoveError  data:[cordova.fileEntry entry]
DOWNLOADER_getFolderError     data:[object error]
```

## Full Examples

### Download file some.png to folder downloads
```javascript
AssetDownloader.init({
  baseUrl: "http://yourhost.com",
  folder: 'downloads',
  fileSystem: cordova.file.dataDirectory
});
AssetDownloader.getAsset("/assets/some.png");
```

### Download file abort.png and abort download, then download another.png
```javascript
AssetDownloader.init({
  baseUrl: "http://yourhost.com",
  folder: 'downloads',
  fileSystem: cordova.file.dataDirectory
});
AssetDownloader.getAsset("/assets/abort.png");
AssetDownloader.abort();
AssetDownloader.init({
  baseUrl: "http://yourhost.com",
  folder: 'downloads',
  fileSystem: cordova.file.dataDirectory
});
AssetDownloader.getAsset("/assets/another.png");
```

### Download multiple files to downloads
```javascript
AssetDownloader.init({
  baseUrl: "http://yourhost.com",
  folder: 'downloads',
  fileSystem: cordova.file.dataDirectory
});
AssetDownloader.getMultipleAssets([
  {url: "/assets/some1.png"},
  {url: "/assets/some2.png"},
  {url: "/assets/some3.png"}
]);
```
