// !minifyOnSave

'use strict';

var readline = require('readline');
var fs = require('fs');
var path = require('path');
var request = require('request');
var parseString = require('xml2js').parseString;
var term = require('node-terminal');


var configurationMode = false;

var config = {};

var configstring = '';
if(fs.existsSync('config.json'))
  configstring = fs.readFileSync('config.json');

if(configstring != ''){
  config = JSON.parse(configstring);
}else{
  console.log('No configuration settings found!');
  configurationMode = true;
}

function saveConfig(configjson){
  fs.writeFile('config.json', JSON.stringify(configjson), function(err){
    if(err != null)
      console.log(err);

    console.log('Configuration file saved!')
  });
}

// process command line and build configuration object
process.argv.forEach(function (val, index, array) {
  if(val == '--configure'){
    // enter configuration module
    configurationMode = true;
  }
});


// configuration mode - read settings from user input
if(configurationMode){
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("Plex address [127.0.0.1]: ", function(address){
    if(address == ""){
      //use the default
      config.address = "127.0.0.1";
    }else{
      config.address = address;
    }


    rl.question("Port [32400]: ", function(port){
      if(port == ""){
        config.port = "32400";
      }else{
        config.port = port;
      }

      rl.question("Overwrite existing Files? [No]", function(overwrite){
        if(overwrite.toLowerCase() == 'yes' || overwrite.toLowerCase() == 'y'){
          config.overwriteExisting = true;
        }else{
          config.overwriteExisting = false;
        }

        rl.question("Save metadata? [Yes]", function(savemeta){
          if(savemeta.toLowerCase() == 'no' || savemeta.toLowerCase() == 'n'){
            config.savemeta = false;
          }else{
            config.savemeta = true;
          }

          rl.question("Save thumbnails? [Yes]", function(savethumbs){
            if(savethumbs.toLowerCase() == 'no' || savethumbs.toLowerCase() == 'n'){
              config.savethumbs = false;
            }else{
              config.savethumbs = true;
            }

            rl.question("Save artwork? [Yes]", function(saveart){
              if(saveart.toLowerCase() == 'no' || saveart.toLowerCase() == 'n'){
                config.saveart = false;
              }else{
                config.saveart = true;
              }

              rl.question("Save poster to containing folder? [Yes]", function(savefolderposter){
                if(savefolderposter.toLowerCase() == 'no' || savefolderposter.toLowerCase() == 'n'){
                  config.savefolderposter = false;
                }else{
                  config.savefolderposter = true;
                }

                rl.question("Save artwork to containing folder? [Yes]", function(savefolderart){
                  if(savefolderart.toLowerCase() == 'no' || savefolderart.toLowerCase() == 'n'){
                    config.savefolderart = false;
                  }else{
                    config.savefolderart = true;
                  }

                  rl.question("Save additional folder.jpg from thumb? [Yes]", function(savefolderthumb){
                    if(savefolderthumb.toLowerCase() == 'no' || savefolderthumb.toLowerCase() == 'n'){
                      config.savefolderthumb = false;
                    }else{
                      config.savefolderthumb = true;
                    }

                    rl.close();
                    saveConfig(config);
                    doScrape();
                  });
                });


              });
            });


          });

        });


      });


    })
  });



}else{
  doScrape();
}

function doScrape(){
  // access PLEX API to discover metadata
  var rootaddr = 'http://' + config.address + ':' + config.port;
  request(rootaddr,
    function(error, response, body){
      // initial request to test server connection
      if(!error && response.statusCode == 200){

        console.log('Discovering Libraries');

        request(rootaddr + '/library/sections',
          function(error, response, body){
            if(!error && response.statusCode == 200){
              parseString(body, function(err,data){
                for(var i=0;i<data.MediaContainer.Directory.length;i++){
                  console.log('Discovered ' + data.MediaContainer.Directory[i].$.title + '...');
                  processLibrary(rootaddr, data.MediaContainer.Directory[i].$.key, data.MediaContainer.Directory[i].$.type, data.MediaContainer.Directory[i].$.title);
                }
              });
            }else{
              console.log('Failed to discover libraries, arborted!')
            }


          }
        )


      }else{
        console.log('Failed to connect to Plex on \"' + rootaddr + '\"');
        console.log('Metadata export aborted!');
      }
    }
  );
}

function processLibrary(rootaddr, librarykey, type, sectionname){
  request(rootaddr + '/library/sections/' + librarykey +'/all', function(error, response, body){
    if(!error && response.statusCode == 200){
      parseString(body, function(err, data){

        if(type == "movie"){

          for(var i=0;i<data.MediaContainer.$.size;i++){
            //console.log(data.MediaContainer.Directory[i])
            processMovie(rootaddr, data.MediaContainer.Video[i].$.key);
          }
        }else{
          console.log("Ignoring \"" + sectionname + "\" Metadata Extractor is not designed to work with sections of type \"" + type + "\"");
        }
      });
    }else{
      console.log("Failed to get section listing for " + sectionname + ' (' + librarykey + ')');
    }
  });
}

function processMovie(rootaddr, url){
  //console.log(url);

  var mediaurl = rootaddr + url;

  request(mediaurl, function(error, response, body){
    if(!error && response.statusCode == 200){
      parseString(body, function(err, data){
        if(data.MediaContainer.Video !== undefined)
          for(var i=0;i<data.MediaContainer.Video.length;i++){
            var videotitle = data.MediaContainer.Video[i].$.title;
            var thumburl = data.MediaContainer.Video[i].$.thumb;
            var arturl = data.MediaContainer.Video[i].$.art;
            if(data.MediaContainer.Video[i].Media !== undefined)
              for(var j=0;j<data.MediaContainer.Video[i].Media.length;j++){
                if(data.MediaContainer.Video[i].Media.optimizedForStreaming === undefined || data.MediaContainer.Video[i].Media.optimizedForStreaming == 0){
                  for(var k=0;k<data.MediaContainer.Video[i].Media[j].Part.length;k++){
                    if(config.savemeta){
                      if(!fs.existsSync(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml') || config.overwriteExisting){
                        fs.writeFile(data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.meta.xml', body, function(){
                          console.log("Saved metadata for " + videotitle);

                        });
                      }
                    }
                    savePoster(rootaddr + thumburl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.thumb.jpg', videotitle);
                    saveArt(rootaddr + arturl, data.MediaContainer.Video[i].Media[j].Part[k].$.file + '.art.jpg', videotitle);
                  }
                }
            }
          }
      });
    }
  });
}
function processSeries(url){

}

function savePoster(url, filepath, videotitle){
  if(config.savethumbs){
    if(!fs.existsSync(filepath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
        console.log("Saved Thumbnail for " + videotitle);
      });
    }
  }
  if(config.savefolderposter){
    var posterpath = path.join(path.dirname(filepath), 'poster.jpg');
    if(!fs.existsSync(posterpath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(posterpath)).on('close', function(){
        console.log("Saved Poster for " + videotitle);
      });
    }
  }
  if(config.savefolderthumb){
    var folderpath = path.join(path.dirname(filepath), 'folder.jpg');
    if(!fs.existsSync(folderpath) || config.overwriteExisting){
      request(url).pipe(fs.createWriteStream(folderpath)).on('close', function(){
        console.log("Saved Folder thumbnail for " + videotitle);
      });
    }
  }

}
function saveArt(url, filepath, videotitle){
  request(url, function(error, response, body){
    if(config.saveart){
      if(!fs.existsSync(filepath) || config.overwriteExisting){
        request(url).pipe(fs.createWriteStream(filepath)).on('close', function(){
          console.log("Saved Artwork for " + videotitle);
        });
      }
    }
    if(config.savefolderart){
      var artpath = path.join(path.dirname(filepath), 'art.jpg');
      if(!fs.existsSync(artpath) || config.overwriteExisting){

        request(url).pipe(fs.createWriteStream(artpath)).on('close', function(){
          console.log("Saved Folder artwork for " + videotitle);
        });
      }
    }

  });
}
