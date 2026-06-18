# GNOME Soundcore Integration

A [GNOME](https://www.gnome.org/) extension to display battery levels for devices supported by [OpenSCQ30](https://github.com/Oppzippy/OpenSCQ30/) as a GNOME tray icon.

![default](src/default.png)
![custom](src/custom.png)
> Customisable string format

The indicator uses the first connected device registered with OpenSCQ30 that provides battery readings. Select a preferred device in the panel menu to remember it across sessions. If it disconnects or cannot provide battery readings, another connected device is used until the preferred device is available again. Select Automatic to clear the preference. Devices are detected again on each poll and Bluetooth connection change.

Open the panel menu to see the device name and each available battery reading, refresh the readings, or open Preferences.

Low-battery notifications are enabled at 20% by default. Change the threshold or disable notifications in Preferences. The displayed device triggers one notification when any battery, including the case, reaches the threshold or is first read below it. Another notification is allowed after all previously observed battery readings rise above the threshold. Disconnecting, switching devices, or temporarily missing a reading does not reset the alert. Alert state lasts until the extension is disabled.

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

Pair your device in Bluetooth settings, then open the extension's Preferences. Under Setup, select the paired Bluetooth device and its model, then click Register. The model list comes from the installed OpenSCQ30 CLI. Registration saves the device as preferred; connect it over Bluetooth to display its battery readings. Use Refresh to reload the device and model lists after pairing another device.

If your CLI is installed as `openscq30`, use that name instead of `openscq30-cli`. The extension accepts either name.

```bash
# Enable
gnome-extensions enable soundcore-integration@ethankuai
gnome-extensions prefs soundcore-integration@ethankuai
```
