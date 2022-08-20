import {App, ButtonComponent, Modal, Notice, TextComponent} from "obsidian";
import FlexiblePomoTimerPlugin from './main';
import {Mode, Timer} from "./timer";

export async function askCustomTimeModal(
    app: App,
    text: string,
    plugin: FlexiblePomoTimerPlugin,
    buttons: { cta: string; secondary: string; thirdaction: string; } = {
        cta: "Start",
        secondary: "Cancel",
        thirdaction: "Reset To Default",
    }
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const modal = new CustomTimeModal(app, plugin, text, buttons);
        modal.onClose = () => {
            resolve(modal.confirmed);
        };
        modal.open();
    });
}

export class CustomTimeModal extends Modal {
    constructor(
        app: App,
        plugin: FlexiblePomoTimerPlugin,
        public text: string,
        public buttons: { cta: string; secondary: string; thirdaction: string }
    ) {
        super(app);
        this._plugin = plugin;
    }
    confirmed: boolean = false;
    _plugin: FlexiblePomoTimerPlugin;



    async display() {
        new Promise((resolve) => {
            this.contentEl.empty();
            this.contentEl.addClass("confirm-modal");
            this.contentEl.createEl("p", {
                text: this.text
            });

            const textBoxEl = this.contentEl.createDiv();
            textBoxEl.createEl('br');

            const pomodoroEl = textBoxEl.createSpan();
            pomodoroEl.appendText('Pomodoro Time (Minutes) : ');
            const pomoCustomText = new TextComponent(pomodoroEl).setValue(this._plugin.settings.pomoCustom + '');
            textBoxEl.createEl('br');

            const shortBreakEl = textBoxEl.createSpan();
            shortBreakEl.appendText('Short Break Time (Minutes)  : ');
            const shortBreakText = new TextComponent(shortBreakEl).setValue(this._plugin.settings.customShortBreak + '');
            textBoxEl.createEl('br');

            const longBreakEl = textBoxEl.createSpan();
            longBreakEl.appendText('Long Break Time (Minutes)  : ');
            const longBreakText = new TextComponent(longBreakEl).setValue(this._plugin.settings.customLongBreak + '');
            textBoxEl.createEl('br');

            const buttonEl = this.contentEl.createDiv(
                "fantasy-calendar-confirm-buttons"
            );
            buttonEl.createEl('br');

            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.cta)
                .setCta()
                .onClick(() => {
                    // check first if valid values
                    debugger;

                    let valid:boolean = false;

                    let pomoNumber:number = parseInt(pomoCustomText.getValue());
                    let shortBreakNumber:number = parseInt(shortBreakText.getValue());
                    let longBreakNumber:number = parseInt(longBreakText.getValue());

                    if(pomoNumber && shortBreakNumber && longBreakNumber) {
                        if(pomoNumber > 0 && shortBreakNumber > 0 && longBreakNumber >0) {
                            valid = true;
                        }
                    }

                    if(valid) {
                        this._plugin.settings.pomoCustom =  +pomoCustomText.getValue();
                        this._plugin.settings.customShortBreak =  +shortBreakText.getValue();
                        this._plugin.settings.customLongBreak =  +longBreakText.getValue();

                        this._plugin.timer = new Timer(this._plugin);
                        this._plugin.timer.triggered = false;
                        this._plugin.showWorkbench();
                        this._plugin.settings.lastUsedPomoType = "pomo-custom"
                        this._plugin.timer.startTimer(Mode.PomoCustom);
                        if (this._plugin.pomoWorkBench) {
                            this._plugin.savePomoWorkBench();
                        }
                        this.close();
                    } else {
                        new Notice('Invalid Inputs');
                    }
                });
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.secondary)
                .onClick(() => {
                    this.close();
                });
            new ButtonComponent(buttonEl)
                .setButtonText(this.buttons.thirdaction)
                .onClick(() => {

                    this._plugin.settings.pomoCustom =  this._plugin.settings.pomo;
                    this._plugin.settings.customShortBreak =  this._plugin.settings.shortBreak;
                    this._plugin.settings.customLongBreak =  this._plugin.settings.longBreak;
                    pomoCustomText.setValue(this._plugin.settings.pomo + '');
                    shortBreakText.setValue(this._plugin.settings.shortBreak + '');
                    longBreakText.setValue(this._plugin.settings.longBreak + '');
                    new Notice('Resetting to Defaults.');

                });
        });
    }
    onOpen() {
        this.display();
    }
}