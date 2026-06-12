# GNOME Soundcore Integration

A [GNOME](https://www.gnome.org/) extension to display battery levels for devices supported by [OpenSCQ30](https://github.com/Oppzippy/OpenSCQ30/) as a GNOME tray icon.

![default](src/default.png)
![custom](src/custom.png)
> Customisable string format

The indicator uses the first connected device registered with OpenSCQ30 that provides battery readings. Select a preferred device in the panel menu to remember it across sessions. If it disconnects or cannot provide battery readings, another connected device is used until the preferred device is available again. Select Automatic to clear the preference. Devices are detected again on each poll and Bluetooth connection change.

Open the panel menu to see the device name and each available battery reading, refresh the readings, or open Preferences.

Leave Label Format empty to show the available battery levels automatically. Custom formats support `{battery}` for a single device battery, `{left}`, `{right}`, and `{case}`. Values are percentages; unavailable values show as `-`. For example, use `{battery}%` for headphones or `L:{left}% R:{right}% C:{case}%` for earbuds.

## Dependencies

This project utilises [OpenSCQ](https://github.com/Oppzippy/OpenSCQ30/) to communicate with Soundcore headphones. OpenSCQ30-cli will need to be installed:

```bash
# Install openscq30-cli
mkdir -p $HOME/.local/bin
curl -L https://github.com/Oppzippy/OpenSCQ30/releases/latest/download/openscq30-cli-linux-x86_64 -o $HOME/.local/bin/openscq30-cli
chmod +x $HOME/.local/bin/openscq30-cli
```

This assumes `~/.local/bin/` is already added to your PATH, which should be default.

Additionally, ensure your GNOME environment has support for extensions & `AppIndicator and KStatusNotifierItem Support` for tray icons.

## Installation

First ensure you have `openscq30-cli` installed (above).

The following is for user installation. To install system-wide, replace `$HOME/.local/` with `/usr/`

```bash
EXTDIR="$HOME/.local/share/gnome-shell/extensions/soundcore-integration@ethankuai"
mkdir -p $EXTDIR
git clone https://github.com/EthanKuai/gnome-soundcore-integration.git $EXTDIR

# Compile
glib-compile-schemas $EXTDIR/schemas/
```

If on Wayland, log-out & back in. If on X11, run `busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting…", global.context)'`.

### Enable

Pair your device over Bluetooth, then register it with OpenSCQ30. Find its model ID with `openscq30-cli list-models` and its MAC address with `bluetoothctl devices`. Register it with `openscq30-cli paired-devices add --mac-address MAC --model MODEL`, replacing `MAC` and `MODEL` with those values.

If your CLI is installed as `openscq30`, use that name instead of `openscq30-cli`. The extension accepts either name.

```bash
# Enable
gnome-extensions enable soundcore-integration@ethankuai
gnome-extensions prefs soundcore-integration@ethankuai
```
