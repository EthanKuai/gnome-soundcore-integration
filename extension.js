import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class SoundcoreBatteryExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new PanelMenu.Button(0.0, 'Soundcore Battery', false);
        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        
        const iconTheme = St.IconTheme.new();
        const iconName = ['audio-headphones-symbolic', 'audio-headset-symbolic', 'audio-card-symbolic']
            .find(name => iconTheme.has_icon(name));
        if (iconName) {
            this._icon = new St.Icon({
                icon_name: iconName,
                style_class: 'system-status-icon',
                style: 'padding: 0px; margin: 0px;',
            });
        } else {
            this._icon = new St.Label({
                text: '🎧',
                y_align: 2,
                style: 'padding: 0px; margin: 0px;',
            });
        }

        this._label = new St.Label({
            text: '',
            y_align: 2,
            style: 'padding-left: 1px;'
        });
        
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);
        Main.panel.addToStatusArea('soundcore-battery', this._indicator);

        this._mac = this._getMac();
        this.disconnected();
        this._update();
        this._startTimer();
        this._watchBluetooth();

        this._settings.connect('changed::poll-interval', () => {
            this._stopTimer();
            this._startTimer();
        });
        this._settings.connect('changed::label-format', () => {
            this._update();
        });
        this._settings.connect('changed::blank-label-format', () => {
            this._update();
        });
        this._settings.connect('changed::hide-icon', () => {
            this._update();
        });
    }

    _watchBluetooth() {
        this._dbusConn = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
        this._dbusConn.signal_subscribe(
            'org.bluez',
            'org.freedesktop.DBus.Properties',
            'PropertiesChanged',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => {
                let [changedIface, changedProps] = [params.get_child_value(0).get_string()[0],
                                                    params.get_child_value(1)];
                if (changedIface === 'org.bluez.Device1') {
                    let connected = changedProps.lookup_value('Connected', null);
                    if (connected !== null) {
                        this._update();
                    }
                }
            }
        );
    }

    _getMac() {
        try {
            let proc = Gio.Subprocess.new(
                ['bash', '-c', "bluetoothctl devices | grep -i 'liberty 4 nc' | sed -E 's|Device ([^ ]+) .+|\\1|'"],
                // ['bash', '-c', "openscq30-cli paired-devices list | grep -oP '([0-9A-F]{2}:){5}[0-9A-F]{2}'"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            let [, stdout] = proc.communicate_utf8(null, null);
            return stdout.trim();
        } catch(e) { return null; }
    }

    _update() {
        if (!this._mac) return;
        GLib.idle_add(GLib.PRIORITY_LOW, () => {
            let proc = Gio.Subprocess.new(
                ['openscq30-cli', 'device', '--mac-address', this._mac,
                 'setting', '--get', 'batteryLevelLeft',
                 '--get', 'batteryLevelRight',
                 '--get', 'caseBatteryLevel'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout] = proc.communicate_utf8_finish(res);
                    let parse = (key) => {
                        let m = new RegExp(key + '\\s+(\\d+)/(\\d+)').exec(stdout);
                        return m ? Math.round(parseInt(m[1]) / parseInt(m[2]) * 100) : null;
                    };
                    let l = parse('batteryLevelLeft');
                    let r = parse('batteryLevelRight');
                    let c = parse('caseBatteryLevel');
                    if (l !== null && r !== null && c !== null) {
                        let fmt = this._settings.get_string('label-format');
                        this._indicator.show();
                        this._label.set_text(fmt
                            .replace('{left}', l)
                            .replace('{right}', r)
                            .replace('{case}', c));
                    } else {
                        this.disconnected();
                    }
                } catch(e) {
                    this.disconnected();
                }
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _startTimer() {
        let interval = this._settings.get_int('poll-interval');
        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, interval, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopTimer() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }
    }
    
    disconnected() {
        if (this._settings.get_boolean('hide-icon')) {
            this._indicator.hide();
        } else {
            this._label.set_text(this._settings.get_string('blank-label-format'));
            this._indicator.show();
        }
    }

    disable() {
        this._stopTimer();
        if (this._indicator) {
            this._indicator.destroy(); this._indicator = null;
        }
        this._settings = null;
        if (this._dbusConn) {
            this._dbusConn = null;
        }
    }
}
