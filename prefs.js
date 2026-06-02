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

        // -----------------------------------------------------

        const groupDevice = new Adw.PreferencesGroup({
            title: 'Device',
        });
        page.add(groupDevice);

        // Device model
        const model = new Adw.EntryRow({
            title: 'Device Model',
            text: settings.get_string('model'),
        });
        model.connect('changed', () => {
            settings.set_string('model', model.get_text());
        });
        groupDevice.add(model);

        // -----------------------------------------------------

        const groupDisplay = new Adw.PreferencesGroup({
            title: 'Display',
        });
        page.add(groupDisplay);

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
        groupDisplay.add(intervalRow);

        // Label format
        const formatRow = new Adw.EntryRow({
            title: 'Label Format',
            text: settings.get_string('label-format'),
        });
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
        groupDisplay.add(formatRow);

        // Hide when disconnected
        const hideRow = new Adw.SwitchRow({
            title: 'Hide icon',
            subtitle: 'Hide icon when device disconnected',
        });
        settings.bind('hide-icon', hideRow, 'active', 0);
        groupDisplay.add(hideRow);

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
        groupDisplay.add(formatBlankRow);

        // -----------------------------------------------------

        const groupDebug = new Adw.PreferencesGroup({
            title: 'Debug',
        });
        page.add(groupDebug);

        const cliFound = GLib.find_program_in_path('openscq30-cli') !== null;
        const cliRow = new Adw.ActionRow({
            title: 'openscq30-cli',
            subtitle: cliFound ? 'openscq30-cli found' : 'openscq30-cli is not installed or not in PATH. See README for instructions.',
            icon_name: cliFound ? 'object-select-symbolic' : 'dialog-warning-symbolic',
        });
        if (!cliFound)
            cliRow.add_css_class('error');
        groupDebug.add(cliRow);

        try {
            let proc = Gio.Subprocess.new(
                ['bash', '-c', "openscq30-cli list-models -j"],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            let [, stdout] = proc.communicate_utf8(null, null);
            if (stdout.trim()) {
                const models = JSON.parse(stdout);
                const modelList = new Adw.ComboRow({
                    title: 'Detected Models',
                });
                modelList.set_model(models);
                modelList.set_active_id(settings.get_string('model'));
                modelList.connect('changed', () => {
                    let [success, iter] = modelList.get_active();
                    if (success) {
                        let model = modelList.get_model().get(iter, 0)[0];
                        settings.set_string('model', model);
                    }
                });
                groupDebug.add(modelList);
            }
        } catch (e) { }
    }
}
