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