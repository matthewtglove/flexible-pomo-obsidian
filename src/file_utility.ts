import {moment, normalizePath, Notice, TFile} from "obsidian";
import FlexiblePomoTimerPlugin from "./main";
import {SavingSuggester} from "./flexipomosuggesters/SavingSuggester";
import {AppHelper} from "./flexipomosuggesters/app-helper";

export class FileUtility {

    private plugin : FlexiblePomoTimerPlugin;

    constructor(plugin:FlexiblePomoTimerPlugin) {
        this.plugin = plugin;
    }

    loadItems(filePath: string, basename:string) {
        if(basename) {
            this.plugin.settings.active_workbench = basename;
            this.plugin.settings.active_workbench_path = filePath;
            this.plugin.saveSettings();
        }
        let workbenchFile:TFile = this.plugin.app.vault.getAbstractFileByPath(normalizePath(filePath)) as TFile;
        if(workbenchFile) {
            let workBenchString:string;
            this.plugin.app.vault.read(workbenchFile).then(value => {
                workBenchString = value;
                let workbenche:string[] = workBenchString.split('###');
                if(workbenche.length) {
                    let activeBench:string = workbenche[workbenche.length - 1];
                    let linePerLine:string[] = activeBench.split('\n');
                    for(const line of linePerLine) {
                        if(line.startsWith('PATHS:')) {
                            let csv:string[];
                            csv = line.substring(7).split(',');
                            for(const csvEntry of csv) {
                                let tFile:TFile = this.plugin.app.vault.getAbstractFileByPath(normalizePath(csvEntry.trim())) as TFile;
                                if(tFile) {
                                    if(tFile.name) {
                                        if(this.plugin.pomoWorkBench.view) {
                                            this.plugin.pomoWorkBench.view.update(tFile);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            this.plugin.pomoWorkBench.redraw();
        }
    }

    async handleAppend(targetFile: TFile) {
        if (!targetFile) {
            // noinspection ObjectAllocationIgnored
            //new Notice("The file is not existing yet.");
            return;
        } else {
            this.saveWorkBenchSettings(targetFile);
            this.plugin.pomoWorkBench.redraw();
            let text:string = "";
            text = text + "### " + moment().format('MM/DD/YYYY HH:mm:ss').toString() + "\n\n";
            for(const workItem of this.plugin.pomoWorkBench.workItems) {
                text = text + "- " + this.plugin.app.fileManager.generateMarkdownLink(workItem.activeNote, '') + "\n";
            }
            text = text + "\n\n";
            text = text + "```\n";
            text =  text + "PATHS: ";
            for(const workItem of this.plugin.pomoWorkBench.workItems) {
                text = text + workItem.activeNote.path + ",";
            }
            text = text + "\n```\n";
            text = text + "\n\n";
            let existingContent = await this.plugin.app.vault.adapter.read(targetFile.path);
            await this.plugin.app.vault.adapter.write(targetFile.path, existingContent + text);

        }
        //fuzzySuggester.close();
    }

    async handleCreateNew(appHelper: AppHelper, searchQuery: string, newLeaf: boolean) {
        const file = await appHelper.createMarkdown(this.plugin.settings.templates_folder + "/" + searchQuery);
        if (!file) {
            // noinspection ObjectAllocationIgnored
            new Notice("This file already exists.");
            return;
        } else {
            this.saveWorkBenchSettings(file);
            this.plugin.pomoWorkBench.redraw();
            let text:string = "";

            text = text + "### " + moment().format('MM/DD/YYYY HH:mm:ss').toString() + "\n\n";
            for(const workItem of this.plugin.pomoWorkBench.workItems) {
                text = text + "- " + this.plugin.app.fileManager.generateMarkdownLink(workItem.activeNote, '') + "\n";
            }
            text = text + "\n\n";
            text = text + "```\n";
            text =  text + "PATHS: ";
            for(const workItem of this.plugin.pomoWorkBench.workItems) {
                text = text + workItem.activeNote.path + ",";
            }
            text = text + "\n```\n";
            text = text + "\n\n";
            let existingContent = await this.plugin.app.vault.adapter.read(file.path);
            await this.plugin.app.vault.adapter.write(file.path, text);
        }
    }

    private saveWorkBenchSettings(file: TFile) {
        this.plugin.settings.active_workbench = file.basename;
        this.plugin.settings.active_workbench_path = file.path;
        this.plugin.saveSettings();
    }
}