import {
    addIcon,
    TAbstractFile,
    TFile,
    WorkspaceLeaf,
} from 'obsidian';
import PomoTimerPlugin from "./main";
import {WorkbenchItemsListView} from "./workbench_view";
import {DEFAULT_DATA, defaultMaxLength, FilePath, WorkbenchItemsListViewType, WorkbenchFilesData} from "./workbench_data";
import {WorkItem} from "./workitem";
import {PomoTaskItem} from "./pomo_task_item";




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
        this.loadPlugin()
    }

    public  loadPlugin() {

        //this.addSettingTab(new RecentFilesSettingTab(this.app, this));
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



    public stopWorkbench = () => {
        this.data.workbenchFiles = new Array<FilePath>();
        this.workItems = new Array<WorkItem>();
        this.view.redraw();
    };

    public initView = async (): Promise<void> => {
        let leaf: WorkspaceLeaf = null;
        for (leaf of this.plugin.app.workspace.getLeavesOfType(WorkbenchItemsListViewType)) {
            if (leaf.view instanceof WorkbenchItemsListView) return;
            // The view instance was created by an older version of the plugin,
            // so clear it and recreate it (so it'll be the new version).
            // This avoids the need to reload Obsidian to update the plugin.
            await leaf.setViewState({type: 'empty'});
            break;
        }
        this.plugin.app.workspace.getRightLeaf(false);
        (leaf ?? this.plugin.app.workspace.getRightLeaf(false)).setViewState({
            type: WorkbenchItemsListViewType,
            active: true,
        });
    };
    private readonly handleRename = async (
        file: TAbstractFile,
        oldPath: string,
    ): Promise<void> => {
        if(this.data.workbenchFiles && this.data.workbenchFiles.length >0) {
            const entry = this.data.workbenchFiles.find(
                (recentFile) => recentFile.path === oldPath,
            );
            if (entry) {
                entry.path = file.path;
                entry.basename = this.trimExtension(file.name);
                let workItemToRemove:WorkItem;
                for(const workItem of this.workItems) {
                    if(workItem.activeNote.path === file.path) {
                        workItemToRemove = workItem;
                        break;
                    }
                }
                this.workItems.remove(workItemToRemove);
                await this.linkFile(file as TFile, workItemToRemove.initialPomoTaskItems);
                this.view.redraw();
            }
        }

    };

    private readonly handleDelete = async (
        file: TAbstractFile,
    ): Promise<void> => {
        if(this.data.workbenchFiles && this.data.workbenchFiles.length >0) {
            const beforeLen = this.data.workbenchFiles.length;
            this.data.workbenchFiles = this.data.workbenchFiles.filter(
                (recentFile) => recentFile.path !== file.path,
            );
            if (beforeLen !== this.data.workbenchFiles.length) {
                this.view.redraw();
            }
            let workItemToRemove:WorkItem;
            for(const workItem of this.workItems) {
                if(workItem.activeNote.path === file.path) {
                    workItemToRemove = workItem;
                    break;
                }
            }
            this.workItems.remove(workItemToRemove);
        }
    };

    private readonly trimExtension = (name: string): string =>
        name.replace(/\.[^/.]+$/, '');


    linkFile = async (openedFile: TFile, initialWorkItems: PomoTaskItem[]): Promise<void> => {
        await this.view.update(openedFile);
        for(const currentItem of this.workItems) {
            if(currentItem.activeNote.path === openedFile.path) {
                return;
            }
        }
        let newWorkItem = new WorkItem(this.plugin.app.workspace.getActiveFile());
        await this.plugin.parseUtility.gatherLineItems(newWorkItem, newWorkItem.initialPomoTaskItems, true);
        if(initialWorkItems) {
            newWorkItem.initialPomoTaskItems = initialWorkItems;
        }
    }
}

const sweepIcon = `
<svg fill="currentColor" stroke="currentColor" version="1.1" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <path d="m495.72 1.582c-7.456-3.691-16.421-0.703-20.142 6.694l-136.92 274.08-26.818-13.433c-22.207-11.118-49.277-2.065-60.396 20.083l-6.713 13.405 160.96 80.616 6.713-13.411c11.087-22.143 2.227-49.18-20.083-60.381l-26.823-13.435 136.92-274.08c3.706-7.412 0.703-16.421-6.694-20.141z"/>
  <circle cx="173" cy="497" r="15"/>
  <circle cx="23" cy="407" r="15"/>
  <circle cx="83" cy="437" r="15"/>
  <path d="m113 482h-60c-8.276 0-15-6.724-15-15 0-8.291-6.709-15-15-15s-15 6.709-15 15c0 24.814 20.186 45 45 45h60c8.291 0 15-6.709 15-15s-6.709-15-15-15z"/>
  <path d="m108.64 388.07c-6.563 0.82-11.807 5.845-12.92 12.349-1.113 6.519 2.153 12.993 8.057 15.952l71.675 35.889c12.935 6.475 27.231 9.053 41.177 7.573-1.641 6.65 1.479 13.784 7.852 16.992l67.061 33.589c5.636 2.78 12.169 1.8 16.685-2.197 2.347-2.091 53.436-48.056 83.3-98.718l-161.6-80.94c-36.208 48.109-120.36 59.39-121.28 59.511z"/>
</svg>`;