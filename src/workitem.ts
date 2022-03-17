import {TFile} from "obsidian";
import {PomoTaskItem} from "./pomo_task_item";

export class WorkItem {
    activeNote: TFile;
    initialPomoTaskItems : PomoTaskItem[];
    postPomoTaskItems:PomoTaskItem[];
    modifiedPomoTaskItems: PomoTaskItem[];
    isStartedActiveNote: boolean;
    hasActiveTask: boolean;

    constructor(activeNote: TFile, isStartedActiveNote: boolean) {
        this.activeNote = activeNote;
        this.initialPomoTaskItems = new Array<PomoTaskItem>();
        this.postPomoTaskItems = new Array<PomoTaskItem>();
        this.modifiedPomoTaskItems = new Array<PomoTaskItem>();
        this.isStartedActiveNote = isStartedActiveNote;
    }
}