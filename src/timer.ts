import {Notice, moment, TFolder, TFile} from 'obsidian';
import {getDailyNote, createDailyNote, getAllDailyNotes} from 'obsidian-daily-notes-interface';
import type {Moment} from 'moment';
import {notificationUrl, whiteNoiseUrl} from './audio_urls';
import {WhiteNoise} from './white_noise';
import {PomoSettings} from './settings';
import FlexiblePomoTimerPlugin from './main';
import {confirmWithModal} from "./extend_modal";
import {PomoTaskItem} from "./pomo_task_item";
import {WorkItem} from "./workitem";


const MILLISECS_IN_MINUTE = 60 * 1000;
const electron = require('electron')

export const enum Mode {
    Pomo,
    ShortBreak,
    LongBreak,
    NoTimer
}


export class Timer {
    plugin: FlexiblePomoTimerPlugin;
    settings: PomoSettings;
    originalStartTime: Moment;
    startTime: Moment; /*when currently running timer started*/
    endTime: Moment;   /*when currently running timer will end if not paused*/
    mode: Mode;
    pausedTime: number;  /*Time left on paused timer, in milliseconds*/
    paused: boolean;
    pomosSinceStart: number;
    cyclesSinceLastAutoStop: number;
    whiteNoisePlayer: WhiteNoise;
    extendPomodoroTime: boolean;
    triggered: boolean;
    extendedTime: Moment;
    allowExtendedPomodoroForSession: boolean;
    win: any;
    workItem: WorkItem;


    constructor(plugin: FlexiblePomoTimerPlugin) {
        this.plugin = plugin;
        this.settings = plugin.settings;
        this.mode = Mode.NoTimer;
        this.paused = false;
        this.pomosSinceStart = 0;
        this.cyclesSinceLastAutoStop = 0;
        this.extendPomodoroTime = false;
        this.triggered = false;
        this.allowExtendedPomodoroForSession = true;
        // initialize white noise player even if it it started as false so that it can be toggled.
        this.whiteNoisePlayer = new WhiteNoise(plugin, whiteNoiseUrl);
    }

    onRibbonIconClick() {
        if (this.mode === Mode.NoTimer) {  //if starting from not having a timer running/paused
            this.startTimer(Mode.Pomo);
        } else { //if timer exists, pause or unpause
            this.togglePause();
        }
    }

    /*Set status bar to remaining time or empty string if no timer is running*/

    //handling switching logic here, should spin out
    async setStatusBarText(): Promise<string> {
        if (this.mode !== Mode.NoTimer) {
            if (this.extendPomodoroTime === false) {
                if (this.paused === true) {
                    if(this.workItem) {
                        return this.workItem.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.workItem.activeNote.basename + ' ) ' + millisecsToString(this.pausedTime) : millisecsToString(this.pausedTime); //just show the paused time
                    } else {
                        return millisecsToString(this.pausedTime); //just show the paused time
                    }
                }
                /*if reaching the end of the current timer, end of current timer*/
                else if (moment().isSameOrAfter(this.endTime)) {
                    if (!this.triggered && this.mode === Mode.Pomo) {
                        await this.handleTimerEnd();
                    } else {
                        await this.handleTimerEnd();
                    }
                }
                if(this.workItem) {
                    return this.workItem.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.workItem.activeNote.basename + ' ) ' + millisecsToString(this.getCountdown()) : millisecsToString(this.getCountdown()); //return display value
                } else {
                    return  millisecsToString(this.getCountdown()); //return display value
                }
            } else {
                if (this.paused === true) {
                    if(this.workItem) {
                        return this.workItem.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.workItem.activeNote.basename + ' ) ' + millisecsToString(this.pausedTime) : millisecsToString(this.pausedTime); //just show the paused time
                    } else {
                        return  millisecsToString(this.pausedTime); //just show the paused time
                    }
                }
                if(this.workItem) {
                    return this.workItem.activeNote && this.plugin.settings.logActiveNote && this.plugin.settings.showActiveNoteInTimer ? '( ' + this.workItem.activeNote.basename + ' ) ' + millisecsToString(this.getStopwatch()) : millisecsToString(this.getStopwatch()); //return display value
                } else {
                    return millisecsToString(this.getStopwatch()); //return display value
                }
            }

        } else {
            return ""; //fixes TypeError: failed to execute 'appendChild' on 'Node https://github.com/kzhovn/statusbar-pomo-obsidian/issues/4
        }
    }

    async stopTimerEarly() {
        if (this.settings.logging === true) {
            await this.logPomo();
            await this.quitTimer();
        }
    }

    async handleTimerEnd() {
        this.triggered = true;
        this.pauseTimer();
        if (this.settings.allowExtendedPomodoro && this.plugin.timer.allowExtendedPomodoroForSession && this.mode === Mode.Pomo) {
            await confirmWithModal(this.plugin.app, "Do You Want To Extend Your Pomodoro Session ? ", this.plugin)
        } else {
            this.extendPomodoroTime = false;
        }
        if (this.extendPomodoroTime && this.mode === Mode.Pomo) {

            this.restartTimer();
            this.extendedTime = moment();
        } else {
            if (this.mode === Mode.Pomo) { //completed another pomo
                this.pomosSinceStart += 1;
                if (this.settings.logging === true) {
                    await this.logPomo();
                    await this.plugin.pomoWorkBench.view.redraw();
                }
            } else if (this.mode === Mode.ShortBreak || this.mode === Mode.LongBreak) {
                this.cyclesSinceLastAutoStop += 1;
            }

            //switch mode
            if (this.settings.notificationSound === true) { //play sound end of timer
                playNotification();
            }

            if (this.mode === Mode.Pomo) {
                if (this.pomosSinceStart % this.settings.longBreakInterval === 0) {
                    this.startTimer(Mode.LongBreak);
                } else {
                    this.startTimer(Mode.ShortBreak);
                }
            } else { //short break. long break, or no timer
                this.startTimer(Mode.Pomo);
            }

            if (this.settings.autostartTimer === false && this.settings.numAutoCycles <= this.cyclesSinceLastAutoStop) { //if autostart disabled, pause and allow user to start manually
                this.pauseTimer();
                this.cyclesSinceLastAutoStop = 0;
            }
        }

    }

    private clearPomoTasks() {
        if(this.workItem) {
            this.workItem.initialPomoTaskItems = new Array<PomoTaskItem>();
            this.workItem.postPomoTaskItems = new Array<PomoTaskItem>();
            this.workItem.modifiedPomoTaskItems = new Array<PomoTaskItem>();
        }
    }

    private closeTimerIndicator() {
        try {
            if (this.win) {
                this.win.close();
            }
        } catch (e) {
        }
    }

    async quitTimer(): Promise<void> {
        this.mode = Mode.NoTimer;
        this.startTime = moment(0);
        this.endTime = moment(0);
        this.paused = false;
        this.pomosSinceStart = 0;
        this.closeTimerIndicator();
        if (this.settings.whiteNoise === true) {
            this.whiteNoisePlayer.stopWhiteNoise();
        }
        this.clearActiveNote();
        if(this.plugin.settings.active_workbench_path) {
            this.plugin.pomoWorkBench.modified = false;
            await this.plugin.fileUtility.handleAppend(this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.active_workbench_path) as TFile);

        }
        this.plugin.pomoWorkBench.workItems = new Array<WorkItem>();
        await this.plugin.pomoWorkBench.view.redraw();
        //await this.plugin.loadSettings(); //w
        await this.plugin.saveSettings(); // save the setting to reflect the latest active workbench.
    }


    private clearActiveNote() {
        if (this.plugin.timer && this.plugin.timer.workItem) {
            this.plugin.timer.workItem = null;
        }
        if (this.plugin.pomoWorkBench && this.plugin.pomoWorkBench.view) {
            this.plugin.pomoWorkBench.view.redraw();
        }
    }

    pauseTimer(): void {
        this.paused = true;
        this.pausedTime = this.getCountdown();

        if (this.settings.whiteNoise === true) {
            this.whiteNoisePlayer.stopWhiteNoise();
        }
    }

    togglePause() {
        if (this.paused === true) {
            this.restartTimer();
        } else if (this.mode !== Mode.NoTimer) { //if some timer running
            this.pauseTimer();
            new Notice("Timer paused.")
        }
    }

    restartTimer(): void {
        this.setStartAndEndTime(this.pausedTime);
        this.modeRestartingNotification();
        this.paused = false;
        if (this.settings.whiteNoise === true) {
            this.whiteNoisePlayer.whiteNoise();
        }
    }

     startTimer(mode: Mode) {
        this.mode = mode;
        this.paused = false;
        this.workItem = new WorkItem(this.plugin.app.workspace.getActiveFile(), true);
        if (mode === Mode.Pomo) {
            if (this.settings.logActiveNote === true) {
                const activeView = this.plugin.app.workspace.getActiveFile();
                if (activeView) {
                    this.workItem.activeNote = activeView;
                    if(this.plugin.pomoWorkBench.workItems.length) {
                        for(const workItem of this.plugin.pomoWorkBench.workItems) {
                            workItem.isStartedActiveNote = false;
                        }
                    }
                    // reinitialize workbench items initial pomo tasks.
                    this.plugin.pomoWorkBench.workItems = new Array<WorkItem>();
                    this.plugin.pomoWorkBench.addWorkbenchItem(this.workItem);
                    for(const workBenchFile of this.plugin.pomoWorkBench.data.workbenchFiles) {
                        const tFile:TFile = this.plugin.app.vault.getAbstractFileByPath(workBenchFile.path) as TFile;
                        let workItem:WorkItem = new WorkItem(tFile, workBenchFile.path === this.workItem.activeNote.path ? true : false);
                        this.plugin.parseUtility.gatherLineItems(workItem, workItem.initialPomoTaskItems, true, workItem.activeNote);
                    }
                    this.plugin.pomoWorkBench.view.update(this.workItem.activeNote,true);
                }
                if (this.settings.logPomodoroTasks === true) {
                    //reset the pomo holders.
                    if(this.workItem) {
                        this.clearPomoTasks();
                        this.plugin.parseUtility.gatherLineItems(this.workItem, this.workItem.initialPomoTaskItems, false, this.plugin.app.workspace.getActiveFile());
                    }
                }
            }
        } else {
            if(this.settings.active_workbench_path) {
                this.plugin.pomoWorkBench.modified = false;
                this.plugin.pomoWorkBench.view.redraw();
                this.plugin.fileUtility.handleAppend(this.plugin.app.vault.getAbstractFileByPath(this.settings.active_workbench_path) as TFile);
            }
            //clear workbench items.
            this.plugin.pomoWorkBench.workItems = new Array<WorkItem>();
            this.closeTimerIndicator();
            this.clearPomoTasks();
            this.clearActiveNote();
        }

        if (this.settings.betterIndicator === true) {
            if (mode === Mode.Pomo) {
                const remote = electron.remote;
                const BrowserWindow = remote.BrowserWindow;
                const win = new BrowserWindow({
                    height: 600,
                    width: 800
                });
                this.win = win;
                this.workItem.activeNote ? win.loadURL('https://grassbl8d.github.io/react-stopwatch/?taskName=' + this.workItem.activeNote.basename + '&reset=true') : win.loadURL('https://grassbl8d.github.io/react-stopwatch')
            }
        }
        this.setStartAndEndTime(this.getTotalModeMillisecs());
        this.originalStartTime = moment();
        this.modeStartingNotification();
        if (this.settings.whiteNoise === true) {
            this.whiteNoisePlayer.whiteNoise();
        }
        this.plugin.pomoWorkBench.view.redraw();
    }

    setStartAndEndTime(millisecsLeft: number): void {
        this.startTime = moment(); //start time to current time
        this.endTime = moment().add(millisecsLeft, 'milliseconds');
    }

    /*Return milliseconds left until end of timer*/
    getCountdown(): number {
        let endTimeClone = this.endTime.clone(); //rewrite with freeze?
        return endTimeClone.diff(moment());
    }

    getStopwatch(): number {
        let startTimeClone = this.extendedTime.clone(); //rewrite with freeze?
        return moment().diff(startTimeClone);
    }

    getTotalModeMillisecs(): number {
        switch (this.mode) {
            case Mode.Pomo: {
                return this.settings.pomo * MILLISECS_IN_MINUTE;
            }
            case Mode.ShortBreak: {
                return this.settings.shortBreak * MILLISECS_IN_MINUTE;
            }
            case Mode.LongBreak: {
                return this.settings.longBreak * MILLISECS_IN_MINUTE;
            }
            case Mode.NoTimer: {
                throw new Error("Mode NoTimer does not have an associated time value");
            }
        }
    }


    /**************  Notifications  **************/

    /*Sends notification corresponding to whatever the mode is at the moment it's called*/
    modeStartingNotification(): void {
        let time = this.getTotalModeMillisecs();
        let unit: string;

        if (time >= MILLISECS_IN_MINUTE) { /*display in minutes*/
            time = Math.floor(time / MILLISECS_IN_MINUTE);
            unit = 'minute';
        } else { /*less than a minute, display in seconds*/
            time = Math.floor(time / 1000); //convert to secs
            unit = 'second';
        }

        switch (this.mode) {
            case (Mode.Pomo): {
                new Notice(`Starting ${time} ${unit} pomodoro. \n` + (this.settings.logActiveNote && this.workItem.activeNote ? `(` + this.workItem.activeNote.basename + `)` : ``));
                break;
            }
            case (Mode.ShortBreak):
            case (Mode.LongBreak): {
                new Notice(`Starting ${time} ${unit} break.`);
                break;
            }
            case (Mode.NoTimer): {
                new Notice('Quitting pomodoro timer.');
                break;
            }
        }
    }

    modeRestartingNotification(): void {
        switch (this.mode) {
            case (Mode.Pomo): {
                new Notice(`Restarting pomodoro.`);
                break;
            }
            case (Mode.ShortBreak):
            case (Mode.LongBreak): {
                new Notice(`Restarting break.`);
                break;
            }
        }
    }

    /**************  Logging  **************/
    async logPomo(): Promise<void> {
        var logText = moment().format(this.settings.logText);
        logText = '- ' + await this.extractLog(this.workItem, logText, false);

        for(const workItem of this.plugin.pomoWorkBench.workItems) {
            if(!workItem.isStartedActiveNote) {
                logText =   await this.extractLog(workItem, logText, true);
            }
        }

        if (this.settings.logToDaily === true) { //use today's note
            let file = (await getDailyNoteFile()).path;
            await this.appendFile(file, logText);
        } else { //use file given in settings
            let file = this.plugin.app.vault.getAbstractFileByPath(this.settings.logFile);

            if (!file || file ! instanceof TFolder) { //if no file, create
                await this.plugin.app.vault.create(this.settings.logFile, "");
            }

            await this.appendFile(this.settings.logFile, logText);
        }
    }

    private  async extractLog(workItem:WorkItem, logText: string, isWorkBench: boolean):Promise<string> {
        await this.plugin.parseUtility.gatherPostPomoTaskItems(workItem);
        if (this.settings.logActiveNote === true) { //append link to note that was active when pomo started
            if(!isWorkBench) {
                logText = logText + " " + this.plugin.app.fileManager.generateMarkdownLink(workItem.activeNote, '');
            } else {
                logText = logText + "\n - 🍏 " + this.plugin.app.fileManager.generateMarkdownLink(workItem.activeNote, '');
            }
            if (this.settings.logPomodoroDuration === true) {
                if(!isWorkBench) {
                    logText = logText +  Math.floor(moment.duration(moment().diff(this.originalStartTime)).asMinutes()) + ' minute/s. ';
                }
            }
            if (this.settings.logPomodoroTasks === true) {
                // log completed items.
                let hasCompleted = workItem.modifiedPomoTaskItems.some((value) => {
                    return value.isCompleted;
                })
                if (hasCompleted) {
                    logText = logText + '\n' + '\t- Completed Items :';
                    workItem.modifiedPomoTaskItems.forEach((value, index) => {
                        if (value.isCompleted) {
                            let inputString = this.cleanString(value.lineContent);
                            logText = logText + "\n" + "\t\t- " + inputString;
                        }
                    });
                }
                let hasNew = workItem.modifiedPomoTaskItems.some((value) => {
                    return !value.isCompleted;
                });
                // log new items.
                if (hasNew) {
                    logText = logText + '\n' + '\t- New/UnTicked Items :';
                    workItem.modifiedPomoTaskItems.forEach(value => {
                        if (!value.isCompleted) {
                            let inputString = this.cleanString(value.lineContent);
                            logText = logText + "\n" + "\t\t- " + inputString;
                        }
                    })
                }
            }
        }
        return logText;
    }

    private cleanString(lineItem: string): string {
        let inputString = lineItem.replace("- [ ]", "").replace("- [x]", "").replace("- [X]", "");
        return inputString.trim();
    }

//from Note Refactor plugin by James Lynch, https://github.com/lynchjames/note-refactor-obsidian/blob/80c1a23a1352b5d22c70f1b1d915b4e0a1b2b33f/src/obsidian-file.ts#L69
    async appendFile(filePath: string, note: string): Promise<void> {
        let existingContent = await this.plugin.app.vault.adapter.read(filePath);
        if (existingContent.length > 0) {
            existingContent = existingContent + '\r';
        }
        await this.plugin.app.vault.adapter.write(filePath, existingContent + note);
    }


}

/*Returns [HH:]mm:ss left on the current timer*/
function millisecsToString(millisecs: number): string {
    let formattedCountDown: string;

    if (millisecs >= 60 * 60 * 1000) { /* >= 1 hour*/
        formattedCountDown = moment.utc(millisecs).format('HH:mm:ss');
    } else {
        formattedCountDown = moment.utc(millisecs).format('mm:ss');
    }

    return formattedCountDown.toString();
}

function playNotification(): void {
    const audio = new Audio(notificationUrl);
    audio.play();
}

export async function getDailyNoteFile(): Promise<TFile> {
    const file = getDailyNote(moment(), getAllDailyNotes());

    if (!file) {
        return await createDailyNote(moment());
    }

    return file;
}






