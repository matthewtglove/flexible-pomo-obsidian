import {
    TFile,
    WorkspaceLeaf,
} from 'obsidian';
import PomoTimerPlugin from "./main";
import {WorkbenchItemsListView} from "./workbench_view";
import {DEFAULT_DATA, defaultMaxLength, FilePath, WorkbenchItemsListViewType, WorkbenchFilesData} from "./workbench_data";
import {WorkItem} from "./workitem";
import {PomoTaskItem} from "./pomo_task_item";
import {Mode} from "./timer";

export default class FlexiblePomoWorkbench {
    public data: WorkbenchFilesData;
    public view: WorkbenchItemsListView;
    public plugin: PomoTimerPlugin;
    public leaf: WorkspaceLeaf;
    workItems: WorkItem[];

    constructor(
        leaf: WorkspaceLeaf,
        plugin: PomoTimerPlugin,
        data: WorkbenchFilesData,
    ) {
        this.leaf = leaf;
        this.plugin = plugin;
        this.data = data;
        this.workItems = new Array<WorkItem>();
    }

    public async unlinkItem(workItem: WorkItem) {
        await this.workItems.remove(workItem);
        let fileToRemove: FilePath;
        for(const workbenchFile of this.data.workbenchFiles) {
            if(workbenchFile.path === workItem.activeNote.path) {
                fileToRemove = workbenchFile;
                break;
            }
        }
        if(fileToRemove) {
            this.data.workbenchFiles.remove(fileToRemove)
        }
        await this.view.redraw();
    }

    public readonly pruneOmittedFiles = async (): Promise<void> => {
        this.data.workbenchFiles = this.data.workbenchFiles.filter(this.shouldAddFile);
        //await this.saveData();
    };

    public readonly pruneLength = async (): Promise<void> => {
        const toRemove =
            this.data.workbenchFiles.length - (this.data.maxLength || defaultMaxLength);
        if (toRemove > 0) {
            this.data.workbenchFiles.splice(
                this.data.workbenchFiles.length - toRemove,
                toRemove,
            );
        }
        //await this.saveData();
    };

    public readonly shouldAddFile = (file: FilePath): boolean => {
        const patterns: string[] = this.data.omittedPaths.filter(
            (path) => path.length > 0,
        );
        const fileMatchesRegex = (pattern: string): boolean => {
            try {
                return new RegExp(pattern).test(file.path);
            } catch (err) {
                console.error('Recent Files: Invalid regex pattern: ' + pattern);
                return false;
            }
        };
        return !patterns.some(fileMatchesRegex);
    };

    public addWorkbenchItem(newWorkItem: WorkItem) {
        let isExisting:boolean = false;
        for(const workbenchItem of this.workItems) {
            if(newWorkItem.activeNote.path === workbenchItem.activeNote.path) {
                isExisting = true;
                workbenchItem.isStartedActiveNote = true;
            }
        }
        if(!isExisting) {
            this.workItems.push(newWorkItem);
        }
    }

    public stopWorkbench = () => {
        if(!this.plugin.settings.persistentWorkbench) {
            this.data.workbenchFiles = new Array<FilePath>();
            this.workItems = new Array<WorkItem>();
        }
        this.view.redraw();
    };

    public initView = async (): Promise<void> => {
        let leaf: WorkspaceLeaf = null;
        for (leaf of this.plugin.app.workspace.getLeavesOfType(WorkbenchItemsListViewType)) {
            if (leaf.view instanceof WorkbenchItemsListView) return;
            // The view instance was created by an older version of the plugin,
            // so clear it and recreate it (so it'll be the new version).
            // This avoids the need to reload Obsidian to update the plugin.
            //await leaf.setViewState({type: 'empty'});
            break;
        }
        this.plugin.app.workspace.getRightLeaf(false);
        (leaf ?? this.plugin.app.workspace.getRightLeaf(false)).setViewState({
            type: WorkbenchItemsListViewType,
            active: true,
        });
    };

    linkFile = async (openedFile: TFile, initialWorkItems: PomoTaskItem[]): Promise<void> => {
        await this.view.update(openedFile,false);
        for(const currentItem of this.workItems) {
            if(currentItem.activeNote.path === openedFile.path) {
                return;
            }
        }
        let newWorkItem = new WorkItem(this.plugin.app.workspace.getActiveFile(), false);
        await this.plugin.parseUtility.gatherLineItems(newWorkItem, newWorkItem.initialPomoTaskItems, true, this.plugin.app.workspace.getActiveFile());
        if(initialWorkItems) {
            newWorkItem.initialPomoTaskItems = initialWorkItems;
        }
    }

     clearWorkBench() {
        if (this.plugin.timer.mode === Mode.Pomo) {
            if (this.workItems.length) {
                this.workItems = this.workItems.filter(value => {
                    if (value.isStartedActiveNote === false) {
                        return false;
                    } else {
                        return true;
                    }
                });
            }
            if (this.data && this.data.workbenchFiles.length > 1) {
                this.data.workbenchFiles = this.data.workbenchFiles.filter(value => {
                    if (this.plugin.timer.workItem && this.plugin.timer.workItem.activeNote) {
                        if (value.path !== this.plugin.timer.workItem.activeNote.path) {
                            return false;
                        } else {
                            return true;
                        }
                    }else {
                        return false;
                    }
                })
                this.view.redraw();
            }
        } else {
            this.workItems = new Array<WorkItem>();
            this.data.workbenchFiles = new Array<FilePath>();
            this.view.redraw();
        }
    }

}
