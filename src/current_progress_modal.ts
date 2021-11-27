import {Modal} from "obsidian";
import FlexiblePomoTimerPlugin from "./main";

export class CurrentProgressModal extends Modal {

    private plugin: FlexiblePomoTimerPlugin;

    constructor(plugin:FlexiblePomoTimerPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onOpen() {
        super.onOpen();
        debugger;
        console.log('on opening');
        const ib = this.contentEl.createDiv('ib');
        let newWorkItems = this.plugin.pomoWorkBench.workItems.map(value => {
            return value;
        })
        for(const newWorkItem of newWorkItems) {
            ib.createDiv({
                text: 'hello',
            })
        }


    }

    onClose() {
        super.onClose();
    }

}