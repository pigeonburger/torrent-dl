#!/usr/bin/env node

var yargs = require('yargs');
var clivas = require("clivas");
var numeral = require("numeral");
var progress = require("progress");
var colors = require("colors");
var parsetorrent = require("parse-torrent");
var torrentStream = require("torrent-stream");
const { exit } = require('yargs');

const argv = yargs
.option('input', {
    alias: 'i',
    description: 'Magnet link, torrent file or link to torrent file.',
    type: 'string',
    require: true,
})
.option('port', {
    alias: 'p',
    description: 'Port to listen on (default 6881)',
    type: 'number',
    default: 6881,
})
.option('connections', {
    alias: 'c',
    description: 'Max number of peers to connect to (default 100)',
    default: 100
    
})
.option('uploadslots', {
    alias: 'u',
    description: 'Number of upload slots (default 10)',
    default: 10,
})
.help()
.alias('help', 'h')
.argv;

var input = argv.input;
var port = argv.port;
var maxpeers = argv.peers;
var upslots = argv.uploadslots;

var totalLength = null;
var downLength = null;
var bar = null;
var timerId = null;
var prevLength = null;
var engine = null;
var verified = 0;
var downloadedPercentage = 0;

var bytes = function(num) {
  return numeral(num).format("0.0b");
};

var setupEngine = function(torrent) {
  engine = torrentStream(torrent, {
    connections: maxpeers,
    uploads: upslots,
    path: ".",
  });

  engine.listen(port);
  engine.on("verify", function() {
    verified++;
    downloadedPercentage = Math.floor(
      (verified / engine.torrent.pieces.length) * 100
    );
  });

  engine.on("ready", function() {
    engine.files.forEach(function(file) {
      file.select();
    });

    totalLengthBytes = engine.files.reduce(function(prevLength, currFile) {
      return prevLength + currFile.length;
    }, 0);

    totalLength = engine.torrent.pieces.length;

    speed = bytes(engine.swarm.downloadSpeed()) + "/s";

    bar = new progress(
      "Downloading " +
        engine.files.length + " files (:perc/" + bytes(totalLengthBytes) + ") [:bar] :percent :etas :speed :peers",
      {
        complete: "=",
        incomplete: " ",
        width: 30,
        total: totalLength
      }
    );

    timerId = setInterval(draw, 500);
  });

  engine.on("idle", function() {
    engine.destroy();
    clearInterval(timerId);
    clivas.clear();
    console.log("------------------");
    engine.files.forEach(function(file) {
      console.log(file.name + " " + bytes(file.length));
    });
    console.log("------------------");
    console.log(
      " downloaded " +
        engine.files.length +
        " files (" +
        bytes(totalLength) +
        ")"
    );
  });
};

parsetorrent.remote(input, function(err, parsedtorrent) {
    if (err) {
        console.error(err.message);
        process.exit(1);
    }

    setupEngine(parsedtorrent);
});

var draw = function() {
  _speed = bytes(engine.swarm.downloadSpeed()) + "/s";
  speed = "{green:" + _speed + "}";
  peers = engine.swarm.wires.length + " peers";

  if (verified >= engine.torrent.pieces.length) {
    clivas.clear();
    clivas.line(" downloading last few pieces " + speed + " " + peers);
  } else {
    bar.tick(verified - prevLength, {
      speed: _speed.green,
      peers: peers,
      perc: bytes((totalLengthBytes*(verified/engine.torrent.pieces.length)).toFixed(1)),
    });
  }
  prevLength = verified;
};
