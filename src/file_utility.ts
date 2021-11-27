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
                                console.log(csvEntry);
                                let tFile:TFile = this.plugin.app.vault.getAbstractFileByPath(normalizePath(csvEntry.trim())) as TFile;
                                if(tFile) {
                                    if(tFile.name) {
                                        this.plugin.pomoWorkBench.view.update(tFile, false);
                                    }
                                }
                            }
                        }
                    }
                }
            });
            this.plugin.pomoWorkBench.view.redraw();
        }
    }

    async handleAppend(targetFile: TFile) {
        if (!targetFile) {
            // noinspection ObjectAllocationIgnored
            new Notice("The file is not existing yet.");
            return;
        } else {
            this.plugin.settings.active_workbench = targetFile.basename;
            this.plugin.settings.active_workbench_path = targetFile.path;
            this.plugin.pomoWorkBench.view.redraw();
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
            this.plugin.app.vault.append(targetFile,text);
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
            this.plugin.settings.active_workbench = file.basename;
            this.plugin.settings.active_workbench_path = file.path;
            this.plugin.pomoWorkBench.view.redraw();
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
            this.plugin.app.vault.append(file,text);
        }
    }
}