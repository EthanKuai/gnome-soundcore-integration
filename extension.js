import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class SoundcoreBatteryExtension extends Extension {
    enable() {
        this._setup();

        this._settings = this.getSettings();
        this._cancellable = new Gio.Cancellable();
        this._updating = false;
        this._indicator = new PanelMenu.Button(0.0, 'Soundcore Battery', false);
        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });

        const iconTheme = St.IconTheme.new();
        this._iconName = ['audio-headphones-symbolic', 'audio-headset-symbolic', 'audio-card-symbolic']
            .find(name => iconTheme.has_icon(name));
        if (this._iconName) {
            this._icon = new St.Icon({
                icon_name: this._iconName,
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

        this._isDisconnected();
        this._watchBluetooth();
        this._update();
        this._startTimer();

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

    // backend
    _setup() {
        // check CLI exists, warn otherwise (only warn on enable)
        this._cli = GLib.find_program_in_path('openscq30-cli')
            ?? GLib.find_program_in_path('openscq30');
        if (!this._cli) {
            this._show_cli_error();
            return;
        }
    }

    _show_cli_error() {
        let source = new MessageTray.Source({
            title: 'Soundcore Battery',
            icon_name: this._iconName ? this._iconName : '🎧',
        });
        Main.messageTray.add(source);

        let notification = new MessageTray.Notification({
            source,
            title: 'Soundcore Integration: CLI not found',
            body: 'openscq30-cli or openscq30 is not installed or not in PATH. See README for instructions.',
        });
        source.addNotification(notification);
    }

    _watchBluetooth() {
        this._dbusConn = Gio.bus_get_sync(Gio.BusType.SYSTEM, null);
        this._bluetoothSignal = this._dbusConn.signal_subscribe(
            'org.bluez',
            'org.freedesktop.DBus.Properties',
            'PropertiesChanged',
            null,
            null,
            Gio.DBusSignalFlags.NONE,
            (conn, sender, path, iface, signal, params) => {
                let [changedIface, changedProps] = [params.get_child_value(0).get_string()[0], params.get_child_value(1)];
                if (changedIface === 'org.bluez.Device1') {
                    let connected = changedProps.lookup_value('Connected', null);
                    if (connected !== null) {
                        this._update();
                    }
                }
            }
        );
    }

    _runCli(args, cancellable) {
        return new Promise((resolve, reject) => {
            let proc = Gio.Subprocess.new(
                [this._cli, ...args, '--json'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            proc.communicate_utf8_async(null, cancellable, (proc, res) => {
                try {
                    let [, stdout] = proc.communicate_utf8_finish(res);
                    if (!proc.get_successful())
                        throw new Error('OpenSCQ30 command failed');
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    proc.force_exit();
                    reject(e);
                }
            });
        });
    }

    async _getDevices(cancellable) {
        const paired = await this._runCli(['paired-devices', 'list'], cancellable);
        const objects = await new Promise((resolve, reject) => {
            this._dbusConn.call(
                'org.bluez', '/', 'org.freedesktop.DBus.ObjectManager',
                'GetManagedObjects', null, null, Gio.DBusCallFlags.NONE, -1,
                cancellable, (conn, res) => {
                    try {
                        resolve(conn.call_finish(res).deepUnpack()[0]);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        });
        const connected = new Set();
        for (const interfaces of Object.values(objects)) {
            const device = interfaces['org.bluez.Device1'];
            if (device?.Connected?.get_boolean())
                connected.add(device.Address.get_string()[0].toUpperCase());
        }
        return paired.filter(device => !device.isDemo
            && connected.has(device.macAddress.toUpperCase()));
    }

    async _getBattery(mac, cancellable) {
        const fields = {
            batteryLevel: 'battery',
            batteryLevelLeft: 'left',
            batteryLevelRight: 'right',
            caseBatteryLevel: 'case',
        };
        const deviceArgs = ['device', '--mac-address', mac];
        const settings = await this._runCli([
            ...deviceArgs, 'list-settings', '--no-categories',
        ], cancellable);
        const ids = Object.keys(fields).filter(id => Object.hasOwn(settings, id));
        if (ids.length === 0)
            return {};

        const values = await this._runCli([
            ...deviceArgs, 'setting', ...ids.flatMap(id => ['--get', id]),
        ], cancellable);
        const battery = {};
        for (const { settingId, value } of values) {
            const match = /^(\d+)\/(\d+)$/.exec(value.value);
            if (Object.hasOwn(fields, settingId) && match
                && Number(match[2]) > 0 && Number(match[1]) <= Number(match[2])) {
                battery[fields[settingId]] = Math.round(Number(match[1]) / Number(match[2]) * 100);
            }
        }
        return battery;
    }

    _formatBattery(battery) {
        const format = this._settings.get_string('label-format');
        if (format) {
            return format.replace(/\{(battery|left|right|case)\}/g,
                (_, field) => battery[field] ?? '-');
        }
        return Object.entries(battery).map(([field, value]) => {
            const prefix = { battery: '', left: 'L:', right: 'R:', case: 'C:' }[field];
            return `${prefix}${value}%`;
        }).join(' ');
    }

    async _update() {
        if (!this._cli || this._updating) return;
        this._updating = true;
        const cancellable = this._cancellable;
        try {
            const devices = await this._getDevices(cancellable);
            for (const device of devices) {
                try {
                    const battery = await this._getBattery(device.macAddress, cancellable);
                    if (cancellable.is_cancelled()) return;
                    if (Object.keys(battery).length > 0) {
                        this._label.set_text(this._formatBattery(battery));
                        this._indicator.show();
                        return;
                    }
                } catch (e) {
                    if (cancellable.is_cancelled()) return;
                }
            }
            if (!cancellable.is_cancelled())
                this._isDisconnected();
        } catch (e) {
            if (!cancellable.is_cancelled())
                this._isDisconnected();
        } finally {
            if (this._cancellable === cancellable)
                this._updating = false;
        }
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

    _isDisconnected() {
        if (this._settings.get_boolean('hide-icon')) {
            this._indicator.hide();
        } else {
            this._label.set_text(this._settings.get_string('blank-label-format'));
            this._indicator.show();
        }
    }

    disable() {
        this._stopTimer();
        this._cancellable.cancel();
        this._cancellable = null;
        if (this._dbusConn) {
            this._dbusConn.signal_unsubscribe(this._bluetoothSignal);
            this._dbusConn = null;
        }
        if (this._indicator) {
            this._indicator.destroy(); this._indicator = null;
        }
        this._settings = null;
    }
}
