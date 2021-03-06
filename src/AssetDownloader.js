/**
 * EVENTS:
 * DOWNLOADER_initialized
 * DOWNLOADER_gotFileSystem
 * DOWNLOADER_gotFolder
 * DOWNLOADER_error
 * DOWNLOADER_noWifiConnection
 * DOWNLOADER_downloadSuccess
 * DOWNLOADER_downloadError
 * DOWNLOADER_downloadProgress
 * DOWNLOADER_fetchSuccess
 * DOWNLOADER_fetchError
 * DOWNLOADER_removeSuccess
 * DOWNLOADER_removeError
 * DOWNLOADER_removeFileGetError
 * DOWNLOADER_getFileError
 * DOWNLOADER_folderRemoved
 * DOWNLOADER_folderRemoveError
 * DOWNLOADER_getFolderError
 *
 *
 * FileObject:{
 *   url: sourceURL for download
 *   name: local filename
 * }
 */
var platforms = {
  isAndroid:function(){return navigator.userAgent.match(/Android/i)!=null},
  isIPad:function(){return navigator.userAgent.match(/iPad/i)!=null},
  isIPhone:function(){return navigator.userAgent.match(/iPod/i)!=null||navigator.userAgent.match(/iPhone/i)!=null},
  isIOS:function(){return this.isIPad()||this.isIPhone()||navigator.userAgent.match(/Macintosh/i)!=null},
  isMobile:function(){return this.isIPad()||this.isIPhone()||this.isAndroid()},
  
  isBlackBerry:function(){return navigator.userAgent.match(/BlackBerry/i)!=null},
  isWindows:function(){return navigator.userAgent.match(/IEMobile/i)!=null||navigator.userAgent.match(/WPDesktop/i)!=null},
  
  isAnyMobile:function(){return this.isAndroid()||this.isIOS()||this.isBlackBerry()||this.isOperaMini()||this.isWindows()}
};
function createEvent(name, data) {
  data = data || [];
  var event = document.createEvent("Event");
  event.initEvent(name);
  event.name = name;
  event.data = data;
  var log = name;
  if (data[0]) log += " : " + data[0];
  //console.log("FIRE "+ log);
  return event;
};
var Downloader = {
  /** @type {string} */
  baseUrl: null,
  /** @type {cordova-plugin-file.FileEntry} */
  localFolder: null,
  /** @type {String} */
  fileSystemURL: null,
  /** @type {cordova-plugin-file.FileSystem} */
  fileSystem: null,
  /** @type {Array.<FileObjects>} */
  downloadQueue: [],
  /** @type {Array.<FileObjects>} */
  deleteQueue: [],
  /** @type {Array.<FileObjects>} */
  fileObjects: [],
  /** @type {FileObject} */
  fileObjectInProgress: null,
  /** @type {boolean} */
  wifiOnly: false,
  /** @type {boolean} */
  loading: false,
  /** @type {boolean} */
  initialized: false,
  /** @type {FileTransfer} */
  transfer: null,
  /** @type {int} */
  retry: 3,

  /**
   * prepare Downloader
   * @param {Object.<String>} options
   */
  initialize: function(options) {
    //console.log("initialize");
    Downloader.initialized = false;
    Downloader.loading = false;
    Downloader.setBaseUrl(options.baseUrl);
    Downloader.setFolder(options.folder);
    if (typeof options.wifiOnly != 'undefined') {
      Downloader.setWifiOnly(options.wifiOnly);
    }
    if (typeof options.noMedia != 'undefined') {
      Downloader.setNoMedia(options.noMedia);
    }
    if (typeof options.fileSystem != 'undefined') {
      Downloader.fileSystemURL = options.fileSystem;
    }

    //console.log("setting Listener");
    document.addEventListener("DOWNLOADER_gotFileSystem", Downloader.onGotFileSystem, false);
    document.addEventListener("DOWNLOADER_gotFolder", Downloader.onGotFolder, false);
    document.addEventListener("DOWNLOADER_downloadSuccess", Downloader.onDownloadSuccess, false);
    document.addEventListener("DOWNLOADER_downloadError", Downloader.onDownloadError, false);
    document.addEventListener("DOWNLOADER_removeSuccess", Downloader.onFileRemoveSuccess, false);
    document.addEventListener("DOWNLOADER_removeError", Downloader.onFileRemoveError, false);
    document.addEventListener("DOWNLOADER_removeFileGetError", Downloader.onFileRemoveGetError, false);
    //console.log("getting filesystem");
    Downloader.getFilesystem();
  },

  /**
   * Adds a File to the downloadQueue and triggers the download when no file is in progress
   * @param {String} url
   */
  load: function(url) {
    //console.log("load");
    //console.log("loading "+url);
    if (!Downloader.isInitialized()) {
      //console.log("wait for initialization");
      document.addEventListener("DOWNLOADER_initialized", function onInitialized(event) {
        //console.log("initialization done");
        event.target.removeEventListener("DOWNLOADER_initialized", onInitialized, false);
        Downloader.load(url);
      }, false);
      return;
    }
    var fileObject = {
      url: url,
      name: url.replace(/^.*\//, "")
    };
    console.log('load fileObject>>>', fileObject);
    Downloader.downloadQueue.push(fileObject);
    if (!Downloader.isLoading()) {
      Downloader.loadNextInQueue();
    }
    return fileObject.name;
  },

  /**
   * loads the next file in the downloadQueue
   * @returns {boolean}
   */
  loadNextInQueue: function() {
    if (Downloader.downloadQueue.length > 0) {
      Downloader.loading = true;
      var fileObject = Downloader.downloadQueue.shift();
      Downloader.fileObjectInProgress = fileObject;
      
      var assetUrl = fileObject.url;
      if(assetUrl.substring(0, 1) === "/") {
        assetUrl = assetUrl.slice(1);
      }
      console.log('localFolder >>> ' + JSON.stringify(Downloader.localFolder));
      //check local file is exist
      var folder = Downloader.localFolder;
      folder.getFile(assetUrl, {
        create: false,
        exclusive: false
      }, function(entry) {
        console.log("local file exist: " + fileObject.url);
        document.dispatchEvent(createEvent("DOWNLOADER_downloadSuccess", [fileObject.url]));
        document.dispatchEvent(createEvent("DOWNLOADER_downloadProgress", [100, fileObject.name]));
      }, function(error) {
        console.log("local file not exist: " + JSON.stringify(error));
        //start download
        Downloader.transferFile(fileObject);
      });
      return true;
    }
    return false;
  },

  /**
   * @param {FileObject} fileObject
   */
  transferFile: function(fileObject) {
    console.log("tranfserFile >>> ", JSON.stringify(fileObject));
    var assetUrl = fileObject.url;
    var downloadUrl = Downloader.baseUrl + assetUrl;
    
    console.log('localFolder >>> ' + JSON.stringify(Downloader.localFolder));
    var localFolder = Downloader.localFolder.toURL();
    if(localFolder.slice(-1) === "/") {
      localFolder = localFolder.substring(0, localFolder.length - 1);
    }

    var filePath = localFolder + assetUrl;
    console.log("filePath >>> ", filePath);
    
    Downloader.transfer = new FileTransfer();
    Downloader.transfer.download(downloadUrl, filePath, function(entry) {
      console.log("transferFile, succcess file name: " + Downloader.fileObjectInProgress.name);
      console.log("transferFile, local path: " + entry.toURL() + ", asset: " + assetUrl);
      document.dispatchEvent(createEvent("DOWNLOADER_downloadSuccess", [assetUrl]));
    }, function(error) {
      // console.log("transferFile, error file name: " + Downloader.fileObjectInProgress.name);
      document.dispatchEvent(createEvent("DOWNLOADER_downloadError", [error]));
    });
    Downloader.transfer.onprogress = function(progressEvent) {
      if (progressEvent.lengthComputable) {
        var percentage = Math.floor(progressEvent.loaded / progressEvent.total * 100);
        document.dispatchEvent(createEvent("DOWNLOADER_downloadProgress", [percentage, fileObject.name]));
      }
    };
  },

  /**
   * Aborts current in-progress transfer and empties the queue
   */
  abort: function() {
    if (Downloader.transfer !== null) {
      Downloader.transfer.abort();
      Downloader.transfer = null;
    }
    Downloader.reset();
  },

  /**
   * Fetch Existing Asset
   * @param {String} url
   */
  fetch: function(url) {
    if (!Downloader.isInitialized()) {
      console.log("wait for initialization");
      document.addEventListener("DOWNLOADER_initialized", function onInitialized(event) {
        console.log("initialization done");
        event.target.removeEventListener("DOWNLOADER_initialized", onInitialized, false);
        Downloader.fetch(url);
      }, false);
      return;
    }
    var assetUrl = url;
    if(assetUrl.substring(0, 1) === "/") {
      assetUrl = assetUrl.slice(1);
    }
    console.log('localFolder >>> ' + JSON.stringify(Downloader.localFolder));
    var folder = Downloader.localFolder;
    folder.getFile(assetUrl, {
      create: false,
      exclusive: false
    }, function(entry) {
      console.log("fetch succcess: " + url);
      document.dispatchEvent(createEvent("DOWNLOADER_fetchSuccess", [url]));
    }, function(error) {
      console.log("fetch error: " + JSON.stringify(error));
      document.dispatchEvent(createEvent("DOWNLOADER_fetchError", [url, error]));
    });
  },

  /**
   * removes assets from the download-directory
   */
  removeDownloads: function() {
    var entry = Downloader.localFolder;
    console.log('Downloads entry', entry);
    entry.removeRecursively(function onRemoved() {
      document.dispatchEvent(createEvent("DOWNLOADER_downloadsRemoved", [entry]));
    }, function onRemoveError() {
      document.dispatchEvent(createEvent("DOWNLOADER_downloadsRemoveError", [entry]));
    });
  },

  /**
   * removes assets with folderPath from the download-directory
   * @param {String} folderPath
   */
  removeFolder: function(folderPath) {
    if(folderPath.substring(0, 1) === "/") {
      folderPath = folderPath.slice(1);
    }
    var folder = Downloader.localFolder;
    folder.getDirectory(folderPath, {
      create: false,
      exclusive: false
    }, function onGotFolderToRemove(entry) {
      console.log('Folder entry', entry);
      entry.removeRecursively(function onRemoved() {
        document.dispatchEvent(createEvent("DOWNLOADER_folderRemoved", [entry]));
      }, function onRemoveError() {
        document.dispatchEvent(createEvent("DOWNLOADER_folderRemoveError", [entry]));
      });
    }, function onGetFolderError(error) {
      document.dispatchEvent(createEvent("DOWNLOADER_getFolderError", [error]));
    });
  },

  /**
   * removes file with path from the download-directory
   * @param {String} path
   */
  deleteAsset: function(path) {
    if (!Downloader.isInitialized()) {
      //console.log("wait for initialization");
      document.addEventListener("DOWNLOADER_initialized", function onInitialized(event) {
        //console.log("initialization done");
        event.target.removeEventListener("DOWNLOADER_initialized", onInitialized, false);
        Downloader.deleteAsset(path);
      }, false);
      return;
    }
    var fileObject = {
      url: path,
      name: path.replace(/^.*\//, "")
    };
    console.log('remove fileObject>>>', fileObject);
    Downloader.deleteQueue.push(fileObject);
    if (!Downloader.isLoading()) {
      Downloader.deleteNextInQueue();
    }
    return fileObject.name;
  },

  /**
   * delete the next file in the deleteQueue
   * @returns {boolean}
   */
  deleteNextInQueue: function() {
    if (Downloader.deleteQueue.length > 0) {
      Downloader.loading = true;
      var fileObject = Downloader.deleteQueue.shift();
      Downloader.fileObjectInProgress = fileObject;
      Downloader.removeFile(fileObject);
      return true;
    }
    return false;
  },

  /**
   * remove file from the download-directory
   * @param {FileObject} fileObject
   */
  removeFile: function(fileObject) {
    var assetUrl = fileObject.url;
    if(assetUrl.substring(0, 1) === "/") {
      assetUrl = assetUrl.slice(1);
    }
    console.log('localFolder >>> ' + JSON.stringify(Downloader.localFolder));
    var folder = Downloader.localFolder;
    folder.getFile(assetUrl, {
      create: false,
      exclusive: false
    }, function onGotFileToRemove(entry) {
      entry.remove(function onRemoved() {
        document.dispatchEvent(createEvent("DOWNLOADER_removeSuccess", [entry]));
      }, function onRemoveError() {
        document.dispatchEvent(createEvent("DOWNLOADER_removeError", [entry]));
      });
    }, function onGetFileError(error) {
      document.dispatchEvent(createEvent("DOWNLOADER_removeFileGetError", [error]));
    });
  },

  /******************* state *******************/

  /**
   * returns true if a download is in progress
   * @returns {boolean}
   */
  isLoading: function() {
    return Downloader.loading;
  },

  /**
   * returns true if Downloader is initialized, false otherwise
   * @returns {boolean}
   */
  isInitialized: function() {
    return Downloader.initialized;
  },

  /**
   * returns true if wifiOnly is set
   * @returns {boolean}
   */
  isWifiOnly: function() {
    return Downloader.wifiOnly;
  },

  /**
   * returns true if wifiOnly is set
   * @returns {boolean}
   */
  isWifiConnection: function() {
    var networkState = navigator.connection.type;
    if (networkState == Connection.WIFI) {
      return true;
    }
    return false;
  },
  /******************* setter *******************/

  /**
   * sets the server baseUrl to downloads
   * @param {string} baseUrl
   */
  setBaseUrl: function(baseUrl) {
    Downloader.baseUrl = baseUrl;
  },
  /**
   * sets the Folder for storing the downloads
   * @param {cordova-plugin-file.FileEntry} folder
   */
  setFolder: function(folder) {
    Downloader.localFolder = folder;
  },
  /**
   * sets if it only possible to download on wifi (not on mobile connection)
   * @param {boolean} wifionly
   */
  setWifiOnly: function(wifionly) {
    Downloader.wifiOnly = wifionly;
  },
  /**
   * resets status-variables to get a fresh downloader after error
   */
  reset: function() {
    //console.log("resetting");
    Downloader.downloadQueue = [];
    Downloader.deleteQueue = [];
    Downloader.fileObjects = [];
    Downloader.fileObjectInProgress = null;
    Downloader.initialized = false;
    Downloader.loading = false;
    Downloader.retry = 3;
  },

  /******************* getter *******************/

  /**
   * gets the persistent FileSystem
   */
  getFilesystem: function() {
    if (Downloader.fileSystemURL) {
      //console.log("Using fileSystemURL:" + Downloader.fileSystemURL);
      window.resolveLocalFileSystemURL(Downloader.fileSystemURL, function(rootfolder) {
        document.dispatchEvent(createEvent("DOWNLOADER_gotFileSystem", [rootfolder]));
      }, function(error) {
        document.dispatchEvent(createEvent("DOWNLOADER_error", [error]));
      });
    } else {
      //console.log("Fallback to Persistant Filesystem");
      window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
      window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
        document.dispatchEvent(createEvent("DOWNLOADER_gotFileSystem", [fileSystem.root]));
      }, function(error) {
        document.dispatchEvent(createEvent("DOWNLOADER_error", [error]));
      });
    }
  },

  /**
   * @param {cordova-plugin-file.File.FileSystem} fileSystem
   * @param {String} folderName
   */
  getFolder: function(fileSystem, folderName) {
    fileSystem.getDirectory(folderName, {
      create: true,
      exclusive: false
    }, function(folder) {
      //console.log("getFolder->Success:" + folder.fullPath + " : " + folder.name);
      document.dispatchEvent(createEvent("DOWNLOADER_gotFolder", [folder]));
    }, function(error) {
      //console.log("getFolder->Error");
      document.dispatchEvent(createEvent("DOWNLOADER_error", [error]));
    });
  },
  /******************* EventHandler *******************/

  /**
   * @param {Object} event
   */
  onDownloadSuccess: function(event) {
    if (!Downloader.loadNextInQueue()) {
      //Downloader.loading = false;
      //Downloader.fileObjectInProgress = null;
      Downloader.reset();
    }
    // reset retry counter;
    Downloader.retry = 3;
  },
  /**
   * @param {Object} event
   */
  onDownloadError: function(event) {
    if (Downloader.retry > 0) {
      // console.log("onDownloadError, retry: " + Downloader.retry);
      Downloader.transferFile(Downloader.fileObjectInProgress);
      Downloader.retry--;
    } else {
      Downloader.reset();
      //console.log("onDownloadError remove listener");
      document.removeEventListener("DOWNLOADER_onDownloadError", Downloader.onDownloadError, false);
      document.removeEventListener("DOWNLOADER_gotFileSystem", Downloader.onGotFileSystem, false);
      document.removeEventListener("DOWNLOADER_gotFolder", Downloader.onGotFolder, false);
      document.removeEventListener("DOWNLOADER_downloadSuccess", Downloader.onDownloadSuccess, false);
    }
  },

  /**
   * @param {Object} event
   */
  onGotFileSystem: function(event) {
    event.target.removeEventListener(event.name, Downloader.onGotFileSystem);
    var fileSystem = event.data[0]; // @type {cordova-plugin-file.File.FileSystem}
    Downloader.fileSystem = fileSystem;
    Downloader.getFolder(fileSystem, Downloader.localFolder);
  },

  /**
   * @param {Object} event
   * @param {cordova-plugin-file.FileEntry} folder
   */
  onGotFolder: function(event) {
    //console.log("onGotFolder");
    event.target.removeEventListener(event.name, Downloader.onGotFolder);
    var folder = event.data[0];// @type {cordova-plugin-file.FileEntry}
    Downloader.localFolder = folder;
    Downloader.initialized = true;
    //console.log("initialized " + Downloader.localFolder.toURL());
    document.dispatchEvent(createEvent("DOWNLOADER_initialized"));
  },

  /**
   * triggers the delete when remove is in progress
   */
  proceedDeleteQueue: function() {
    if (!Downloader.deleteNextInQueue()) {
      Downloader.reset();
      document.removeEventListener("DOWNLOADER_removeError", Downloader.onFileRemoveError, false);
      document.removeEventListener("DOWNLOADER_removeSuccess", Downloader.onFileRemoveSuccess, false);
      document.removeEventListener("DOWNLOADER_removeFileGetError", Downloader.onFileRemoveGetError, false);
    }
  },
  /**
   * @param {Object} event
   */
  onFileRemoveSuccess: function(event) {
    Downloader.proceedDeleteQueue();
  },
  /**
   * @param {Object} event
   */
  onFileRemoveError: function(event) {
    Downloader.proceedDeleteQueue();
  },
  /**
   * @param {Object} event
   */
  onFileRemoveGetError: function(event) {
    Downloader.proceedDeleteQueue();
  },

  /******************* API *******************/
  interface: {
    obj: null,
    /**
     * initializes the downloader
     * @param {Object} options
     *   - folder: sets folder to store downloads [required]
     *   - wifiOnly: true -> only Download when connected to Wifi, else fire "DOWNLOADER_noWifiConnection" event [default: false]
     */
    init: function(options) {
      if (!options.folder) {
        console.error("You have to set a folder to store the downloaded files into.");
        return;
      }
      options = options || {};
      Downloader.initialize(options);
      Downloader.interface.obj = Downloader;
    },
    isInitialized: function() {
      return Downloader.isInitialized();
    },
    setWifiOnly: function(wifionly) {
      Downloader.setWifiOnly(wifionly);
    },
    getBaseRelativePath: function() {
      var baseRelativePath = '';
      var dummy = document.createElement("a");
      dummy.setAttribute("href", ".");
      var baseURL = dummy.href;
      if(baseURL.indexOf('cordova-hot-code-push-plugin') === -1) {
        var localFolder = Downloader.localFolder.toURL();
        if(localFolder.slice(-1) === "/") {
          localFolder = localFolder.substring(0, localFolder.length - 1);
        }
        baseRelativePath = localFolder;
      } else {
        if(platforms.isAndroid()) {
          baseRelativePath = '../../../downloads';
        } else if(platforms.isIOS()) {
          baseRelativePath = '../../../../../Application Support/downloads';
        }
      }
      return baseRelativePath;
    },
    /**
     * download file at url
     * @param {String} url
     *
     */
    getAsset: function(url) {
      if (!url) {
        console.error("You have to specify a url where the file is located you wanna download");
        return;
      }
      if (Downloader.isWifiOnly() && !Downloader.isWifiConnection()) {
        document.dispatchEvent(createEvent("DOWNLOADER_noWifiConnection"));
        return;
      }
      return Downloader.load(url);
    },
    /**
     * downloads multiple Files
     * DownloadObject:{
     *   url: sourceURL for download,
     * }
     * @param {Array.<DownloadObject>} list
     */
    getMultipleAssets: function(list) {
      if (Downloader.isWifiOnly() && !Downloader.isWifiConnection()) {
        document.dispatchEvent(createEvent("DOWNLOADER_noWifiConnection"));
        return;
      }
      for (var i = 0; i < list.length; i++) {
        var url = list[i];
        Downloader.load(url);
      }
    },
    /**
     * get exisitng Files
     * fetchObject:{
     *   url: sourceURL for download,
     * }
     * @param {Array.<fetchObject>} list
     */
    getExistingAssets: function(list) {
      for (var i = 0; i < list.length; i++) {
        var url = list[i];
        Downloader.fetch(url);
      }
    },
    abort: function() {
      Downloader.abort();
    },
    removeDownloads: function() {
      Downloader.removeDownloads();
    },
    removeFolder: function(folderPath) {
      Downloader.removeFolder(folderPath);
    },
    removeMultipleAssets: function(list) {
      for (var i = 0; i < list.length; i++) {
        var path = list[i];
        Downloader.deleteAsset(path);
      }
    },
  }
};

module.exports = Downloader.interface;