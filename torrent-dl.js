#!/usr/bin/env node

var fs = require('fs');
var prompt = require("prompt-sync")({
    sigint: true
});
var yargs = require('yargs');
var progress = require("progress");
var colors = require("colors");
var parsetorrent = require("parse-torrent");
var torrentStream = require("torrent-stream");
var request = require("request");

var search_sites = {'tpb': "The Pirate Bay", 'ia': "Internet Archive", 'st': 'SolidTorrents'};

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
    .option('search', {
        alias: 's',
        description: 'Makes the -i option a search query for an available torrent site specified [Available sites are: tpb]',
        type: 'string',
        default: null,
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
    .version("Torrent-DL Version 1.3.0")
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

function bytes(a, b = 1, k = 1024) {
    with(Math) {
        let d = floor(log(a) / log(k));
        return 0 == a ? "0 Bytes" : parseFloat((a / pow(k, d)).toFixed(max(0, b))) + " " + ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d]
    }
}

async function torrenter(input) {
    return new Promise((resolve, reject) => {
        var totalLength = null;
        var bar = null;
        var prevLength = null;
        var verified = 0;
        var downloadedPercentage = 0;
        var notice2 = null;

        var setupEngine = function(torrent) {
            engine = torrentStream(torrent, {
                connections: maxpeers,
                uploads: upslots,
                path: ".",
                trackers: trackers
            });
            console.log("Fetching files.....");
            var notice = setTimeout(() => {
                console.log(colors.italic("Fetching the torrent metadata is taking longer than expected. The torrent may not have enough peers to start a download. You can exit by pressing Ctrl-C or wait a little longer for peers to connect."));
            }, 10000);
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
                clearTimeout(notice);
                notice2 = setTimeout(() => {
                    console.log(colors.italic("\nThis is taking a while :( The torrent may not have enough peers to start a download. You can exit by pressing Ctrl-C or wait a little longer for peers to connect."));
                }, 10000);
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
            if (swarmlength === 1) {
                peers = engine.swarm.wires.length + " peer";
            } else {
                peers = engine.swarm.wires.length + " peers";
            }

            if (verified >= engine.torrent.pieces.length) {
                console.log("Downloading last few pieces " + speed + " " + peers);
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
                if (engine.swarm.wires.length !== 0) {
                    clearTimeout(notice2);
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
        if (argv.search) {
            var sitecontent = await searcher(argv.search, input);
            var totallength = sitecontent.length;
            if (sitecontent.length === 0) {
                console.log(colors.red(`No torrents found for ${input} on ${search_sites[argv.search.toLowerCase()]}`));
                continue;
            }
            let download = false;
            let index = 0;

            while (!download) {
                var current = sitecontent[index];

                let name = current['name'];
                let date = current['date'];
                let source = current['source'];
                let size = current['size'];
                let files = current['files'];
                let url = current['url'];
                let seeders = current['seeders'];
                let leechers = current['leechers'];

                var tn = (totallength === 1) ? 'torrent' : 'torrents';

                if (files === '0') {
                    files = "Could not fetch number of files"
                } else {
                    files = (files === 1) ? `${files} file` : `${files} files`
                }

                console.log(colors.green(`Found ${totallength} ${tn}.\n`) + colors.magenta(`Torrent ${index + 1}:\n\n`) + `${'Name:'.yellow} ${name}
${'Date Added:'.yellow} ${date}
${'Size:'.yellow} ${size} (${files})
${'Source:'.yellow} ${source}
${'Seeders:'.yellow} ${seeders}
${'Leechers:'.yellow} ${leechers}
${'URL:'.yellow} ${url}
        `)

                if (index === 0) {
                    var answer = prompt(`${'Do you want to download this torrent?'.cyan} (${'Y'.yellow} = Yes, ${'Enter'.yellow} = Show next option, ${'Any other key'.yellow} = Exit): `).toLowerCase()
                    if (answer === 'y') {
                        download = true;
                    } else if (answer === '') {
                        console.clear();
                        index++;
                        continue;
                    } else {
                        process.exit(1);
                    }
                } else if (index + 1 !== sitecontent.length) {
                    var answer = prompt(`${'Do you want to download this torrent?'.cyan} (${'Y'.yellow} = Yes, ${'Enter'.yellow} = Show next option, ${'B'.yellow} = Show previous option, ${'Any other key'.yellow} = Exit): `).toLowerCase()
                    if (answer === 'y') {
                        download = true;
                    } else if (answer === '') {
                        console.clear();
                        index++;
                        continue;
                    } else if (answer === 'b') {
                        console.clear();
                        index--;
                        continue;
                    } else {
                        process.exit(1);
                    }
                } else {
                    var answer = prompt(`${'Do you want to download this torrent?'.cyan} (${'Y'.yellow} = Yes, ${'B'.yellow} = Show previous option, ${'Any other key'.yellow} = Exit): `).toLowerCase()
                    if (answer === 'y') {
                        download = true;
                    } else if (answer === 'b') {
                        console.clear();
                        index--;
                        continue;
                    } else {
                        process.exit(1);
                    }
                }
            }
            input = current['source']
        }

        await torrenter(input);
        if (engine) {
            engine.destroy();
            clearInterval(timerId);
            let current_length = engine.files.length;
            total_files = total_files + current_length;
            total_size = total_size + totalLengthBytes;
            if (current_length === 1) {
                console.log("Downloaded " + engine.files.length + " file (" + bytes(totalLengthBytes) + ")\n");
            } else {
                console.log("Downloaded " + engine.files.length + " files (" + bytes(totalLengthBytes) + ")\n");
            }
            engine = null;
        }
    }

    // Make shore you're grammer is korrect";
    if (total_files === 1) {
        var s1 = 'file';
    } else {
        var s1 = 'files';
    }
    if (inputs.length === 1) {
        var s2 = 'torrent';
    } else {
        var s2 = 'torrents';
    }
    if (errors === 0) {
        var s3 = colors.green('no failed');
    } else {
        var s3 = colors.red(`${errors} failed`);
    }

    console.log(`Finished downloading ${total_files} ${s1} from ${inputs.length} ${s2} (Total size: ${bytes(total_size)}) (${s3})`);
    process.exit(1);
}

async function searcher(site, query) {
    return new Promise((resolve, reject) => {
        // TPB
        if (site.toLowerCase() === 'tpb') {
            console.log(`Searching ${search_sites[site.toLowerCase()]} for "${query}"......`);
            request(`https://apibay.org/q.php?q=${query}&cat=0`, function(error, response, html) {
                if (!error && response.statusCode == 200) {
                    let json = JSON.parse(html);
                    let data = [];
                    if (json[0]['name'] !== 'No results returned') {
                        for (let item of json) {
                            let itemdata = {};
                            itemdata['date'] = new Date(parseInt(item['added'], 10) * 1000).toLocaleString('en-AU', {
                                hour12: false
                            });
                            itemdata['name'] = item['name'];
                            itemdata['source'] = item['info_hash'];
                            itemdata['seeders'] = item['seeders'];
                            itemdata['leechers'] = item['leechers'];
                            itemdata['size'] = bytes(item['size']);
                            itemdata['files'] = item['num_files'];
                            itemdata['url'] = "https://thepiratebay.org/description.php?id=" + item['id'];
                            data.push(itemdata);
                        }
                    }
                    resolve(data);
                }
            });
        } else if (site.toLowerCase() === 'ia') {
            console.log(`Searching ${search_sites[site.toLowerCase()]} for "${query}"......`);
            request(`https://archive.org/advancedsearch.php?q=${query}+AND+format%3A%22BitTorrent%22&fl[]=identifier&fl[]=item_size&fl[]=publicdate&fl[]=title&rows=200&page=1&output=json#json`, function(error, response, html) {
                if (!error && response.statusCode == 200) {
                    let json = JSON.parse(html);
                    let data = [];
                    if (json['response']['numFound'] !== 0) {
                        for (let item of json['response']['docs']) {
                            let itemdata = {};
                            let id = item['identifier'];
                            itemdata['date'] = item['publicdate'];
                            itemdata['name'] = item['title'];
                            itemdata['source'] = `https://archive.org/download/${id}/${id}_archive.torrent`;
                            itemdata['seeders'] = "N/A";
                            itemdata['leechers'] = "N/A";
                            itemdata['size'] = bytes(item['item_size']);
                            itemdata['files'] = "N/A";
                            itemdata['url'] = `https://archive.org/details/${id}`;
                            data.push(itemdata);
                        }
                    }
                    resolve(data);
                }
            })
        } else if (site.toLowerCase() === 'st'){
            request(`https://solidtorrents.net/api/v1/search?q=${query}&category=all&sort=seeders`, function(error, response, html) {
                if (!error && response.statusCode == 200) {
                    let json = JSON.parse(html);
                    let data = [];
                    if (json['hits']['value'] !== 0) {
                        for (let item of json['results']) {
                            let itemdata = {};
                            itemdata['date'] = item['imported'];
                            itemdata['name'] = item['title'];
                            itemdata['source'] = item['infohash'];
                            itemdata['seeders'] = item['swarm']['seeders'];
                            itemdata['leechers'] = item['swarm']['leechers'];
                            itemdata['size'] = bytes(item['size']);
                            itemdata['files'] = "N/A";
                            itemdata['url'] = `https://itorrents.org/torrent/${item['infohash']}.torrent`;
                            data.push(itemdata);
                        }
                    }
                    resolve(data);
                }
            });
        } else {
            console.log(`Invalid torrent site specified. Available options are: tpb (${search_sites['tpb']}), ia (${search_sites['ia']}), st (${search_sites['st']})`);
            process.exit(1);
        }
    })
}

init();