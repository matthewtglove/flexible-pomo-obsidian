import {PomoTaskItem} from "./pomo_task_item";
import FlexiblePomoTimerPlugin from "./main";
import {WorkItem} from "./workitem";
import {TFile} from "obsidian";

export class ParseUtility {

    plugin: FlexiblePomoTimerPlugin;

    constructor(plugin: FlexiblePomoTimerPlugin) {
        this.plugin = plugin;
    }

    async gatherPostPomoTaskItems(workItem: WorkItem) {
        let activeFileContent: string;
        // ensure that post pomotaskitems are not reused.
        if(workItem.postPomoTaskItems.length) {
            workItem.postPomoTaskItems = new Array<PomoTaskItem>();
        }
        if(workItem.modifiedPomoTaskItems.length) {
            workItem.modifiedPomoTaskItems = new Array<PomoTaskItem>();
        }
        await this.plugin.app.vault.read(workItem.activeNote).then(value => {
            activeFileContent = value;
        });
        activeFileContent.split("\n").forEach((value, index) => {
            if (value.trim().startsWith('- [ ]')) {
                workItem.postPomoTaskItems.push( new PomoTaskItem(value.replace('- [ ]', ""), false, workItem.activeNote.path));
            } else if (value.trim().startsWith('- [x]') || value.trim().startsWith('- [X]')) {
                workItem.postPomoTaskItems.push(new PomoTaskItem(value.replace('- [x]', '').replace('- [X]', ''), true, workItem.activeNote.path));
            }
        })
        workItem.postPomoTaskItems.forEach((value, index, array) => {
            if (!workItem.initialPomoTaskItems.some(initialvalue => {
                return (value.lineContent === initialvalue.lineContent && value.isCompleted === initialvalue.isCompleted);
            })) {
                workItem.modifiedPomoTaskItems.push(value);
            }
        });
    }

    async gatherLineItems(newWorkItem: WorkItem, pomoTaskItems: Array<PomoTaskItem>, isStore: boolean, activeFile:TFile) {
        let activeFileContent: string;
        await this.plugin.app.vault.read(activeFile).then(value => {
                activeFileContent = value;
        });
        this.processActiveFileContents(activeFileContent, pomoTaskItems, isStore, newWorkItem);
    }

    private processActiveFileContents(activeFileContent: string, pomoTaskItems: Array<PomoTaskItem>, isStore: boolean, newWorkItem: WorkItem) {
        activeFileContent.split("\n").forEach((value, index) => {
            if (value.trim().startsWith('- [ ]')) {
                pomoTaskItems.push(new PomoTaskItem(value.replace('- [ ]', ""), false, newWorkItem.activeNote.path));
            } else if (value.trim().startsWith('- [x]') || value.trim().startsWith('- [X]')) {
                pomoTaskItems.push(new PomoTaskItem(value.replace('- [x]', '').replace('- [X]', ''), true, newWorkItem.activeNote.path));
            }
        })
        if (isStore) {
            this.plugin.pomoWorkBench.addWorkbenchItem(newWorkItem);
        }
    }



}
