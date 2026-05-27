# GNOME Soundcore Integration

> [!info] A [GNOME](https://www.gnome.org/) extension to display Soundcore headphone's battery levels as a GNOME tray icon.

## Dependencies

This project utilises [OpenSCQ](https://github.com/Oppzippy/OpenSCQ30/) to communicate with Soundcore headphones. OpenSCQ30-cli will need to be installed:

```bash
# Install openscq30-cli
mkdir -p ~/.local/bin
curl -L https://github.com/Oppzippy/OpenSCQ30/releases/latest/download/openscq30-cli-linux-x86_64 -o ~/.local/bin/openscq30-cli
chmod +x ~/.local/bin/openscq30-cli
```

Additionally, ensure your GNOME environment has support for extensions & `AppIndicator and KStatusNotifierItem Support` for tray icons.

## Installation

First ensure you have `openscq30-cli` installed (above).

The following is for user installation. To install system-wide, replace `$HOME/.local/` with `/usr/`

```bash
EXTDIR="$HOME/.local/share/gnome-shell/extensions/soundcore-integration@ethankuai"
mkdir -p $EXTDIR
git clone https://github.com/EthanKuai/gnome-soundcore-integration.git $EXTDIR

# Compile
glib-compile-schemas ~/.local/share/gnome-shell/extensions/soundcore-battery@local/schemas/
```

If on Wayland, log-out & back in. If on X11, run `busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting…", global.context)'`.

### Enable

``bash
gnome-extensions enable soundcore-integration@ethankuai
gnome-extensions prefs soundcore-integration@ethankuai
```
