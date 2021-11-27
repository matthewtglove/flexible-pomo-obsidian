import {Modal} from "obsidian";
import FlexiblePomoTimerPlugin from "./main";
import {WorkItem} from "./workitem";

export class CurrentProgressModal extends Modal {

    private plugin: FlexiblePomoTimerPlugin;

    constructor(plugin:FlexiblePomoTimerPlugin) {
       super(plugin.app);
       this.plugin = plugin;
    }

    onOpen() {
        super.onOpen();
        this.contentEl.empty();
        const ib = this.contentEl.createDiv('ib');
        this.postPomo(this.plugin.pomoWorkBench.workItems).then(() => {
            for(const newWorkItem of this.plugin.pomoWorkBench.workItems) {
                if(newWorkItem.modifiedPomoTaskItems.length) {
                    const div = ib.createDiv({
                        text: 'NOTE: ' + newWorkItem.activeNote.basename + "\n",
                    })
                    for(const modifiedTask of newWorkItem.modifiedPomoTaskItems) {
                        div.createDiv({
                            text: '  --> ' + (modifiedTask.isCompleted ? '[X] ' : '[ ] ') + '- ' +  modifiedTask.lineContent
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