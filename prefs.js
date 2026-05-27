import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SoundcoreBatteryPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

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
    }
}
