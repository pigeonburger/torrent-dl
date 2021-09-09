#!/usr/bin/env node

var fs = require('fs');
var yargs = require('yargs');
var clivas = require("clivas");
var numeral = require("numeral");
var progress = require("progress");
var colors = require("colors");
var parsetorrent = require("parse-torrent");
var torrentStream = require("torrent-stream");

const argv = yargs
    .usage("Torrent-DL\nCommand-Line Torrent Downloader\n\nUsage: torrent-dl -i [MAGNET LINK OR TORRENT FILE] [OPTIONS]")
    .option('input', {
        alias: 'i',
        description: 'Magnet link, infohash, torrent file or link to torrent file.',
        type: 'string',
        require: true,
    })
    .option('port', {
        alias: 'p',
        description: 'Port to listen on.',
        type: 'number',
        default: 6881,
    })
    .option('connections', {
        alias: 'c',
        description: 'Max number of peers to connect to.',
        type: 'number',
        default: 100

    })
    .option('uploadslots', {
        alias: 'u',
        description: 'Number of upload slots.',
        type: 'number',
        default: 10,
    })
    .option('tracker', {
        alias: 't',
        description: 'Manually add a tracker URL (can be used more than once if adding multiple trackers)',
        type: 'string',
        default: null,
    })
    .option('verbose', {
        alias: 'v',
        description: 'Print extra informational output.',
        type: 'boolean',
        default: false,
    })
    .help()
    .version("Torrent-DL Version 1.1.0")
    .alias('help', 'h')
    .argv;

var indata = argv.input
var port = argv.port;
var maxpeers = argv.connections;
var upslots = argv.uploadslots;
var trackers = argv.tracker;
var errors = 0;

inputs = [];
if (indata.constructor === String && indata.toLowerCase().endsWith('.txt')) {
    fs.readFileSync(indata, 'utf-8').split(/\r?\n/).forEach(function(line) {
        inputs.push(line);
    })
} else if (indata.constructor === Array) {
    for (let item of indata) {
        inputs.push(item);
    }
} else {
    inputs.push(indata);
}

var engine = null;
var timerId = null;

var bytes = function(num) {
    return numeral(num).format("0.0b");
};

async function torrenter(input) {
    return new Promise((resolve, reject) => {
        var totalLength = null;
        var bar = null;
        var prevLength = null;
        var verified = 0;
        var downloadedPercentage = 0;

        var setupEngine = function(torrent) {
            engine = torrentStream(torrent, {
                connections: maxpeers,
                uploads: upslots,
                path: ".",
                trackers: trackers
            });
            console.log("Fetching files.....");
            if (argv.verbose) {
                console.log("Downloading from torrent: " + input)
                console.log("Listening on port " + port)
                console.log("Maximum peer connections: " + maxpeers)
                console.log("Upload slots: " + upslots)
            }
            engine.listen(port);
            engine.on("verify", function() {
                verified++;
                downloadedPercentage = Math.floor(
                    (verified / engine.torrent.pieces.length) * 100
                );
            });

            engine.on("ready", function() {
                console.log("\n------------------");
                console.log(colors.bold.magenta("Found " + Object.keys(engine.files).length + " files:"));
                engine.files.forEach(function(file) {
                    console.log(colors.yellow(file.name) + " | " + colors.green(bytes(file.length)));
                    file.select();
                });
                console.log("------------------\n");

                totalLengthBytes = engine.files.reduce(function(prevLength, currFile) {
                    return prevLength + currFile.length;
                }, 0);

                totalLength = engine.torrent.pieces.length;

                speed = bytes(engine.swarm.downloadSpeed()) + "/s";

                bar = new progress(
                    "Downloading " +
                    engine.files.length + " files (:perc/" + bytes(totalLengthBytes) + ") |:bar| :percent ETA: :etas :speed :peers", {
                        complete: "█",
                        incomplete: " ",
                        width: 30,
                        total: totalLength
                    }
                );
                timerId = setInterval(draw, 200);
            });

            engine.on("idle", function() {
                resolve();
            });
        };

        parsetorrent.remote(input, function(err, parsedtorrent) {
            try {
                /*if (err) {
                    console.error(err.message);
                    //process.exit(1);
                    resolve();
                }*/
                setupEngine(parsedtorrent);
            } catch (e) {
                errors++;
                console.error(colors.yellow("ERROR: " + e.message));
                resolve();
            }
        });

        var draw = function() {
            _speed = bytes(engine.swarm.downloadSpeed()) + "/s";
            speed = "{green:" + _speed + "}";
            let swarmlength = engine.swarm.wires.length;
            if (swarmlength === 1){
                peers = engine.swarm.wires.length + " peer";
            } else {
                peers = engine.swarm.wires.length + " peers";
            }

            if (verified >= engine.torrent.pieces.length) {
                clivas.clear();
                clivas.line("Downloading last few pieces " + speed + " " + peers);
            } else {
                if (argv.verbose) {
                    console.clear();
                    console.log("\n------------------");
                    console.log(colors.bold.magenta("Found " + Object.keys(engine.files).length + " files:"));
                    engine.files.forEach(function(file) {
                        console.log(colors.yellow(file.name) + " | " + colors.green(bytes(file.length)));
                        file.select();
                    });
                    console.log("------------------\n");
                    var peertable = [];
                    console.log("Downloading from torrent: " + input);
                    console.log("Listening on port " + port);
                    console.log("Maximum peer connections: " + maxpeers);
                    console.log("Upload slots: " + upslots);
                    console.log("\nPEER INFO:");
                    for (let p of engine.swarm.wires) {
                        let vals = p['peerAddress'].split(":");
                        let ip = vals[0];
                        let pport = parseInt(vals[1], 10);
                        let downloaded = p['downloaded'];
                        let uploaded = p['uploaded']
                        let data = {
                            IP: ip,
                            Port: pport,
                            Downloaded: bytes(downloaded),
                            Uploaded: bytes(uploaded)
                        };
                        peertable.push(data);
                    }
                    console.table(peertable);
                    console.log('\n');
                }
                bar.tick(verified - prevLength, {
                    speed: _speed.green,
                    peers: peers,
                    perc: bytes((totalLengthBytes * (verified / engine.torrent.pieces.length)).toFixed(1)),
                });
            }
            prevLength = verified;
        };
    })
}

async function init() {
    var total_files = 0;
    var total_size = 0;
    for (let input of inputs) {
        await torrenter(input);
        if (engine) {
            engine.destroy();
            clearInterval(timerId);
            let current_length = engine.files.length;
            total_files = total_files + current_length;
            total_size = total_size + totalLengthBytes;
            if (current_length === 1){
                console.log("Downloaded " + engine.files.length + " file (" + bytes(totalLengthBytes) + ")\n");
            } else {
                console.log("Downloaded " + engine.files.length + " files (" + bytes(totalLengthBytes) + ")\n");
            }
            engine = null;
        }
    }

    // Make shore you're grammer is korrect";
    if (total_files === 1){
        var s1 = 'file';
    } else {
        var s1 = 'files';
    }
    if (inputs.length === 1){
        var s2 = 'torrent';
    } else {
        var s2 = 'torrents';
    }
    if (errors === 0){
        var s3 = colors.green('no failed');
    } else {
        var s3 = colors.red(`${errors} failed`);
    }

    console.log(`Finished downloading ${total_files} ${s1} from ${inputs.length} ${s2} (Total size: ${bytes(total_size)}) (${s3})`);
    process.exit(1);
}
init();