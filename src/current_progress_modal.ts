import {Modal} from "obsidian";
import FlexiblePomoTimerPlugin from "./main";
import {WorkItem} from "./workitem";

export class CurrentProgressModal extends Modal {

    private plugin: FlexiblePomoTimerPlugin;
    private mode: number;

    constructor(plugin:FlexiblePomoTimerPlugin) {
       super(plugin.app);
       this.plugin = plugin;
    }

    openProgressModal(mode: number) {
        this.mode = mode;
        this.open();
    }

    onOpen() {
        super.onOpen();
        this.contentEl.empty();
        const ib = this.contentEl.createDiv('ib');


        this.postPomo(this.plugin.pomoWorkBench.workItems).then(() => {
            for (const newWorkItem of this.plugin.pomoWorkBench.workItems) {
                let workItems;
                if (this.mode === 0) {
                    workItems = newWorkItem.modifiedPomoTaskItems;
                } else if (this.mode === 1) {
                    // Show Open Items Onlly
                    workItems = newWorkItem.postPomoTaskItems.filter((item) => {
                        return item.isCompleted ? false : true;
                    });
                } else if(this.mode === 2) {
                    // Show All Items
                    workItems = newWorkItem.postPomoTaskItems;
                } else if(this.mode === 3) {
                    workItems = newWorkItem.postPomoTaskItems.filter((item) => {
                        if(this.plugin.app.workspace.getActiveFile() && item.filePath === this.plugin.app.workspace.getActiveFile().path && !item.isCompleted) {
                            return true;
                        } else {
                            return false;
                        }
                    })
                } else if(this.mode === 4) {
                    workItems = newWorkItem.postPomoTaskItems.filter((item) => {
                        if(this.plugin.app.workspace.getActiveFile() && item.filePath === this.plugin.app.workspace.getActiveFile().path) {
                            return true;
                        } else {
                            return false;
                        }
                    })
                }
                if (workItems.length) {
                    const div = ib.createDiv({
                        text: 'NOTE: ' + newWorkItem.activeNote.basename + "\n",
                    })
                    for (const workItemTask of workItems) {
                        div.createDiv({
                            text: '  --> ' + (workItemTask.isCompleted ? '[X] ' : '[ ] ') + '- ' + workItemTask.lineContent
                        })
                    }
                }
            }
            })


    }

    private async postPomo(newWorkItems: Array<WorkItem>):Promise<void> {
        for(const newWork of newWorkItems) {
            await this.plugin.parseUtility.gatherPostPomoTaskItems(newWork);
        }
    }

    onClose() {
        super.onClose();
    }

}