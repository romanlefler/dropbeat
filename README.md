# Dropbeat

Dropbeat is a GNOME shell extension that shows a cool card to control your media player.

![Screenshot](./docs/screenshot.png)

## Requires

ImageMagick (available in all distros' official repos)

## Installation

[![Get on GNOME Extensions](./docs/ego.png)](https://extensions.gnome.org/extension/8261/simpleweather/)

## Features

- Control your media player from the top bar
- View album art, track title, and artist name
- Play, pause, and skip tracks
- Works with any MPRIS player such as Firefox, Spotify, VLC, etc.
- Configurable global shortcut to toggle open the card

## Current Limitations

- No shuffle, loop, or volume controls
- No seeking controls or progress bar
- Always only shows last active player in the case of multiple players

## Building

Build to `dist/build`:

```shell
make
```

Launch test GNOME shell instance:

```shell
./nest-test
```

Install via Makefile:

```shell
make install
```

