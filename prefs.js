import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SoundcoreBatteryPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);
        this._addSetup(page, window, settings);

        const group = new Adw.PreferencesGroup({
            title: 'Display',
        });
        page.add(group);

        // Poll interval
        const intervalRow = new Adw.SpinRow({
            title: 'Poll Interval',
            subtitle: 'How often to update battery levels (seconds)',
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 300,
                step_increment: 5,
            }),
        });
        settings.bind('poll-interval', intervalRow, 'value', 0);
        group.add(intervalRow);

        // Label format
        const formatRow = new Adw.EntryRow({
            title: 'Label Format',
            text: settings.get_string('label-format'),
        });
        formatRow.set_tooltip_text('Leave empty for automatic formatting. Placeholders: {battery}, {left}, {right}, {case}. Unavailable values show as -.');
        formatRow.connect('changed', () => {
            settings.set_string('label-format', formatRow.get_text());
        });
        // Reset label format
        const resetButton = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Reset to default',
        });
        resetButton.connect('clicked', () => {
            settings.reset('label-format');
            formatRow.set_text(settings.get_string('label-format'));
        });
        formatRow.add_suffix(resetButton);
        group.add(formatRow);
        
        // Hide when disconnected
        const hideRow = new Adw.SwitchRow({
            title: 'Hide icon',
            subtitle: 'Hide icon when device disconnected',
        });
        settings.bind('hide-icon', hideRow, 'active', 0);
        group.add(hideRow);
        
        // Blank label format
        const formatBlankRow = new Adw.EntryRow({
            title: 'Blank label Format',
            text: settings.get_string('blank-label-format'),
        });
        formatBlankRow.connect('changed', () => {
            settings.set_string('blank-label-format', formatBlankRow.get_text());
        });
        // Reset blank label format
        const resetBlankButton = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Reset to default',
        });
        resetBlankButton.connect('clicked', () => {
            settings.reset('blank-label-format');
            formatBlankRow.set_text(settings.get_string('blank-label-format'));
        });
        formatBlankRow.add_suffix(resetBlankButton);
        group.add(formatBlankRow);

        const notificationGroup = new Adw.PreferencesGroup({
            title: 'Notifications',
        });
        page.add(notificationGroup);
        const notificationRow = new Adw.SwitchRow({
            title: 'Low-battery notifications',
            subtitle: 'Notify once when the displayed device reaches the threshold',
        });
        settings.bind('low-battery-notifications', notificationRow, 'active', 0);
        notificationGroup.add(notificationRow);
        const thresholdRow = new Adw.SpinRow({
            title: 'Low-battery threshold',
            subtitle: 'Battery percentage, including the charging case',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 100,
                step_increment: 1,
            }),
        });
        settings.bind('low-battery-threshold', thresholdRow, 'value', 0);
        settings.bind('low-battery-notifications', thresholdRow, 'sensitive', 0);
        notificationGroup.add(thresholdRow);
    }

    _addSetup(page, window, settings) {
        const group = new Adw.PreferencesGroup({ title: 'Setup' });
        page.add(group);
        const deviceRow = new Adw.ComboRow({ title: 'Paired Bluetooth device', enable_search: true });
        const modelRow = new Adw.ComboRow({ title: 'OpenSCQ30 model', enable_search: true });
        group.add(deviceRow);
        group.add(modelRow);
        const statusRow = new Adw.ActionRow({ title: 'Registration', use_markup: false });
        const refreshButton = new Gtk.Button({ label: 'Refresh', valign: Gtk.Align.CENTER });
        const registerButton = new Gtk.Button({ label: 'Register', valign: Gtk.Align.CENTER });
        statusRow.add_suffix(refreshButton);
        statusRow.add_suffix(registerButton);
        group.add(statusRow);

        const cli = GLib.find_program_in_path('openscq30-cli')
            ?? GLib.find_program_in_path('openscq30');
        const cancellable = new Gio.Cancellable();
        const processes = new Set();
        let devices = [];
        let models = [];
        let registered = [];
        let busy = false;
        window.connect('close-request', () => {
            cancellable.cancel();
            for (const process of processes)
                process.force_exit();
            return false;
        });

        const updateSensitivity = () => {
            deviceRow.set_sensitive(!busy && devices.length > 0);
            modelRow.set_sensitive(!busy && models.length > 0);
            refreshButton.set_sensitive(!busy && Boolean(cli));
            registerButton.set_sensitive(!busy && Boolean(devices[deviceRow.selected])
                && Boolean(models[modelRow.selected]));
        };
        const selectRegisteredModel = () => {
            const device = devices[deviceRow.selected];
            const paired = registered.find(item => item.macAddress.toUpperCase() === device?.macAddress);
            const index = models.findIndex(item => item.model === paired?.model);
            modelRow.selected = index >= 0 ? index : Gtk.INVALID_LIST_POSITION;
            updateSensitivity();
        };
        deviceRow.connect('notify::selected', () => {
            if (!busy)
                selectRegisteredModel();
        });
        modelRow.connect('notify::selected', updateSensitivity);

        const runCli = args => new Promise((resolve, reject) => {
            const process = Gio.Subprocess.new([cli, ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            processes.add(process);
            process.communicate_utf8_async(null, cancellable, (process, result) => {
                processes.delete(process);
                try {
                    const [, stdout, stderr] = process.communicate_utf8_finish(result);
                    if (!process.get_successful())
                        throw new Error(stderr.trim() || 'OpenSCQ30 command failed.');
                    resolve(stdout);
                } catch (error) {
                    if (cancellable.is_cancelled())
                        process.force_exit();
                    reject(error);
                }
            });
        });
        const getBluetoothDevices = () => new Promise((resolve, reject) => {
            Gio.bus_get(Gio.BusType.SYSTEM, cancellable, (_source, result) => {
                let connection;
                try {
                    connection = Gio.bus_get_finish(result);
                } catch (error) {
                    reject(error);
                    return;
                }
                connection.call('org.bluez', '/', 'org.freedesktop.DBus.ObjectManager',
                    'GetManagedObjects', null, null, Gio.DBusCallFlags.NONE, -1,
                    cancellable, (connection, result) => {
                        try {
                            const objects = connection.call_finish(result).deepUnpack()[0];
                            const paired = [];
                            for (const interfaces of Object.values(objects)) {
                                const device = interfaces['org.bluez.Device1'];
                                if (!device?.Paired?.get_boolean()) continue;
                                const macAddress = device.Address.get_string()[0].toUpperCase();
                                paired.push({
                                    macAddress,
                                    name: device.Alias?.get_string()[0]
                                        ?? device.Name?.get_string()[0] ?? macAddress,
                                });
                            }
                            resolve(paired);
                        } catch (error) {
                            reject(error);
                        }
                    });
            });
        });
        const refresh = async () => {
            if (busy || cancellable.is_cancelled()) return;
            busy = true;
            updateSensitivity();
            statusRow.subtitle = 'Loading paired devices and supported models…';
            const selected = devices[deviceRow.selected]?.macAddress
                ?? settings.get_string('preferred-device');
            try {
                const results = await Promise.allSettled([
                    getBluetoothDevices(),
                    runCli(['list-models', '--json']),
                    runCli(['paired-devices', 'list', '--json']),
                ]);
                if (cancellable.is_cancelled()) return;
                const failed = results.find(result => result.status === 'rejected');
                if (failed) throw failed.reason;
                const nextModels = JSON.parse(results[1].value);
                const nextRegistered = JSON.parse(results[2].value);
                devices = results[0].value;
                models = nextModels;
                registered = nextRegistered.filter(device => !device.isDemo);
                deviceRow.model = Gtk.StringList.new(devices.map(device => `${device.name} — ${device.macAddress}`));
                modelRow.model = Gtk.StringList.new(models.map(model => model.name));
                const index = devices.findIndex(device => device.macAddress === selected);
                deviceRow.selected = index >= 0 ? index : devices.length > 0 ? 0 : Gtk.INVALID_LIST_POSITION;
                selectRegisteredModel();
                statusRow.subtitle = devices.length === 0
                    ? 'No paired Bluetooth devices. Pair a device in Bluetooth Settings, then refresh.'
                    : models.length === 0 ? 'OpenSCQ30 returned no supported models.'
                        : 'Choose your device and its model, then register it.';
            } catch (error) {
                if (!cancellable.is_cancelled())
                    statusRow.subtitle = `Could not load setup: ${error.message}`;
            } finally {
                if (!cancellable.is_cancelled()) {
                    busy = false;
                    updateSensitivity();
                }
            }
        };
        refreshButton.connect('clicked', refresh);
        registerButton.connect('clicked', async () => {
            const device = devices[deviceRow.selected];
            const model = models[modelRow.selected];
            if (busy || !device || !model || cancellable.is_cancelled()) return;
            busy = true;
            updateSensitivity();
            statusRow.subtitle = 'Registering device…';
            try {
                await runCli(['paired-devices', 'add', '--mac-address', device.macAddress,
                    '--model', model.model]);
                if (cancellable.is_cancelled()) return;
                registered = registered.filter(item => item.macAddress.toUpperCase() !== device.macAddress);
                registered.push({ macAddress: device.macAddress, model: model.model });
                settings.set_string('preferred-device', device.macAddress);
                statusRow.subtitle = `${device.name} registered and selected as the preferred device.`;
            } catch (error) {
                if (!cancellable.is_cancelled())
                    statusRow.subtitle = `Could not register device: ${error.message}`;
            } finally {
                if (!cancellable.is_cancelled()) {
                    busy = false;
                    updateSensitivity();
                }
            }
        });
        updateSensitivity();
        if (cli)
            refresh();
        else
            statusRow.subtitle = 'OpenSCQ30 CLI not found. Install openscq30-cli or openscq30, then reopen Preferences.';
    }
}
