# Torrent-DL
*Download Torrents via the Command-Line*

This is a simple but efficient command-line Bittorrent client, which aims to be "Youtube-DL for Torrents".

------

## Description

Torrent-DL is an efficient command-line program allowing you to quickly download files via the Bittorrent protocol.

It is built using [`node.js`](https://github.com/nodejs/node), but does not require it to be installed on your computer if you download it from the [releases](https://github.com/pigeonburger/torrent-dl/releases/latest/) page.

The `torrent-dl` binaries are all approximately 30MB in size, as they come pre-bundled with a small `node.js` runtime so they can run on any computer.

---

## Usage

```
torrent-dl -i [MAGNET LINK OR TORRENT FILE] [OPTIONS]
```

At the very basic level, the only option you need to provide is `-i`, e.g:

```
torrent-dl -i magnet:?xt=urn:btih:b26c81363ac1a236765385a702aec107a49581b5
```

This command will start downloading the Ubuntu 20.04 Desktop ISO.

You can also just pass the torrent's infohash:

```
torrent-dl -i b26c81363ac1a236765385a702aec107a49581b5
```

You are also able to provide the path to a downloaded torrent file, e.g:

```
torrent-dl -i /path/to/torrent-file.torrent
```

You can also provide a *link* to a torrent without having to download it:

```
torrent-dl -i https://releases.ubuntu.com/20.04/ubuntu-20.04.3-desktop-amd64.iso.torrent
```

More options available for use are below.

---

## Options


### `-i, --input`
Magnet link, infohash, torrent file or link to torrent file [REQUIRED]

### `-p, --port`
Port to listen for incoming peers [Default is 6881]

### `-c, --connections`
Maximum number of peers to connect to [Default is 100]

### `-u, --uploadslots`
Number of upload slots [Default is 10]

### `-t, --tracker`
Manually add a custom tracker URL (can be used more than once if adding multiple trackers)

### `-v, --verbose`
Prints extra informational output (such as data about connected peers)

### `-h, --help`
Show the help menu.

### `--version`
Print the `torrent-dl` version number.


---

## Installation

Windows users can download the latest `torrent-dl` release from [here](https://github.com/pigeonburger/torrent-dl/releases/latest/download/torrent-dl-windows-x64) and place it anywhere in their system [PATH](https://en.wikipedia.org/wiki/PATH_%28variable%29) except for `%SYSTEMROOT%\System32` (e.g. do not put in `C:\Windows\System32`).

To install right away for Linux users:

```
sudo curl -L https://github.com/pigeonburger/torrent-dl/releases/latest/download/torrent-dl-linux-x64 -o /usr/local/bin/torrent-dl
sudo chmod a+rx /usr/local/bin/torrent-dl
```

To install right away for MacOS users:

```
sudo curl -L https://github.com/pigeonburger/torrent-dl/releases/latest/download/torrent-dl-macos-x64 -o /usr/local/bin/torrent-dl
sudo chmod a+rx /usr/local/bin/torrent-dl
```

If you *do* have `node.js` and `npm` installed on your device, then feel free to install it with:

```
npm install -g torrent-dl
```
(requires `node.js` v12 or higher)

---

## Troubleshooting

### I'm stuck on "Fetching files....." or "0 peers"
A number of factors could have caused this

- The torrent may have 0 seeders, meaning the file cannot currently be downloaded 😬 sorry to be the bearer of bad news if this is the case. You can leave `torrent-dl` running like that and if a seeder ever pops up again, it will start downloading it.

- Some ISPs block commonly used torrenting ports like 6881 - try switching to a different, larger port number. e.g. `--port 43022`

- ISPs can also block P2P communication altogether, if this is the case for you, use a VPN.

### My download speed is really slow
Your download speed can only be as fast as the combined upload speeds of all peers you're connected to, and this can vary depending on the torrent. Often, the more peers you're connected to, the faster you'll be able to download the files.

You can increase the maximum number of peers you can connect to with the `-c` option, e.g. `-c 250`

---

## To-Do List

- Add support for passing a `.txt` file containing a list of multiple torrents.
- Proxy support.
- Configuration file support.
- Add automatic search and download functionality for popular torrent sites.
- Make `--verbose` output look less stupid.

---

## Acknowledgements

This project was adapted from [tget](https://github.com/jeffjose/tget) to add more functions and configurability. 

Without the [torrent-stream](https://github.com/mafintosh/torrent-stream) library, this project would be nowhere near as straightforward as it is.

---

## License

MIT