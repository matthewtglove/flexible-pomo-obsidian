import {TFile} from "obsidian";
import {PomoTaskItem} from "./pomo_task_item";

export class WorkItem {
    activeNote: TFile;
    initialPomoTaskItems : PomoTaskItem[];
    postPomoTaskItems:PomoTaskItem[];
    modifiedPomoTaskItems: PomoTaskItem[];

    constructor(activeNote: TFile) {
        this.activeNote = activeNote;
        this.initialPomoTaskItems = new Array<PomoTaskItem>();
        this.postPomoTaskItems = new Array<PomoTaskItem>();
        this.modifiedPomoTaskItems = new Array<PomoTaskItem>();
    }
}