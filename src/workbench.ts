import {
    TFile,
    WorkspaceLeaf,
} from 'obsidian';
import FlexiblePomoTimerPlugin from "./main";
import {WorkbenchItemsListView} from "./workbench_view";
import {DEFAULT_DATA, defaultMaxLength, FilePath, WorkbenchItemsListViewType, WorkbenchFilesData} from "./workbench_data";
import {WorkItem} from "./workitem";
import {PomoTaskItem} from "./pomo_task_item";
import {Mode} from "./timer";
import {CurrentProgressModal} from "./current_progress_modal";

export default class FlexiblePomoWorkbench {
    public data: WorkbenchFilesData;
    public view: WorkbenchItemsListView;
    public plugin: FlexiblePomoTimerPlugin;
    public leaf: WorkspaceLeaf;
    public modified: boolean;
    workItems: WorkItem[];
    public current_progress_modal: CurrentProgressModal;

    constructor(
        leaf: WorkspaceLeaf,
        plugin: FlexiblePomoTimerPlugin,
        data: WorkbenchFilesData,
    ) {
        this.leaf = leaf;
        this.plugin = plugin;
        this.data = data;
        this.workItems = new Array<WorkItem>();
        this.modified = false;
        this.current_progress_modal = new CurrentProgressModal(this.plugin);
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
        await this.redraw();
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
        if(this.plugin.settings.workbench_location && this.plugin.settings.workbench_location === 'left') {
            (leaf ?? this.plugin.app.workspace.getLeftLeaf(false)).setViewState({
                type: WorkbenchItemsListViewType,
                active: true,
            });
        } else if(this.plugin.settings.workbench_location && this.plugin.settings.workbench_location === 'right'){
            (leaf ?? this.plugin.app.workspace.getRightLeaf(false)).setViewState({
                type: WorkbenchItemsListViewType,
                active: true,
            });
        } else {
            (leaf ?? this.plugin.app.workspace.getRightLeaf(false)).setViewState({
                type: WorkbenchItemsListViewType,
                active: true,
            });
        }
    };

    linkFile = async (openedFile: TFile, initialWorkItems: PomoTaskItem[]): Promise<void> => {
        let existingFile:boolean = false;
        for(const workBenchFile of this.data.workbenchFiles) {
            if(workBenchFile.path === openedFile.path) {
                existingFile = true;
            }
        }
        if(!existingFile) {
            await this.view.update(openedFile);
        }
        for(const currentItem of this.workItems) {
            if(currentItem.activeNote.path === openedFile.path) {
                return;
            }
        }
        if(this.plugin.timer.mode === Mode.Pomo) {
            let newWorkItem = new WorkItem((this.plugin.app.workspace.getActiveFile() || this.plugin.app.workspace.lastActiveFile), false);
            await this.plugin.parseUtility.gatherLineItems(newWorkItem, newWorkItem.initialPomoTaskItems, true, (this.plugin.app.workspace.getActiveFile() || this.plugin.app.workspace.lastActiveFile));
            if(initialWorkItems) {
                newWorkItem.initialPomoTaskItems = initialWorkItems;
            }
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
                this.redraw();
            }
        } else {
            this.workItems = new Array<WorkItem>();
            this.data.workbenchFiles = new Array<FilePath>();
            this.redraw();
        }
    }

    shiftPositionDatafile(isMoveUp:boolean) {
        let index: number = 0;
        let hasMatch: boolean = false;
        for (const workbenchFile of this.data.workbenchFiles) {
            if (workbenchFile.path === (this.plugin.app.workspace.getActiveFile() ?  this.plugin.app.workspace.getActiveFile().path : this.plugin.app.workspace.lastActiveFile.path)) {
                hasMatch = true;
                break;
            }
            index++;
        }
        if(isMoveUp) {
            if(hasMatch && (index - 1) >= 0) {
                this.arrayMoveDatafile(this.data.workbenchFiles, index, index -1);
                this.modified = true;
                this.redraw();
            }
        } else {
            if(hasMatch && (index) < this.data.workbenchFiles.length + 1) {
                this.arrayMoveDatafile(this.data.workbenchFiles, index, index +1);
                this.modified = true;
                this.redraw();
            }
        }
    }

    shiftPositionWorkItem(isMoveUp:boolean) {
        let index: number = 0;
        let hasMatch: boolean = false;
        for (const workItem of this.workItems) {
            if (workItem.activeNote.path === (this.plugin.app.workspace.getActiveFile() ? this.plugin.app.workspace.getActiveFile().path : this.plugin.app.workspace.lastActiveFile.path)) {
                hasMatch = true;
                break;
            }
            index++;
        }
        if (isMoveUp) {
            if (hasMatch && (index - 1) >= 0) {
                this.arrayMoveWorkItem(this.workItems, index, index - 1);
                this.modified = true;
                this.redraw();
            }
        } else {
            if (hasMatch && (index) < this.workItems.length + 1) {
                this.arrayMoveWorkItem(this.workItems, index, index + 1);
                this.modified = true;
                this.redraw();
            }
        }
    }



    arrayMoveDatafile(arr:Array<FilePath>, fromIndex:number, toIndex:number) {
        let element = arr[fromIndex];
        arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, element);
    }

    arrayMoveWorkItem(arr:Array<WorkItem>, fromIndex:number, toIndex:number) {
        let element = arr[fromIndex];
        arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, element);
    }

     redraw() {
        if(this.view) {
            this.view.redraw();
        }
    }

}
