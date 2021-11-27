import {ItemView, Menu, Notice, TFile, WorkspaceLeaf,} from 'obsidian';

import FlexiblePomoTimerPlugin from "./main";
import {FilePath, WorkbenchFilesData, WorkbenchItemsListViewType} from "./workbench_data";
import FlexiblePomoWorkbench from "./workbench";

export class WorkbenchItemsListView extends ItemView {
    private readonly plugin: FlexiblePomoTimerPlugin;
    private data: WorkbenchFilesData;
    private workbench: FlexiblePomoWorkbench;

    constructor(
        leaf: WorkspaceLeaf,
        plugin: FlexiblePomoTimerPlugin,
        data: WorkbenchFilesData,
        workbench: FlexiblePomoWorkbench,
    ) {
        super(leaf);

        this.plugin = plugin;
        this.data = data;
        this.workbench = workbench;
        this.redraw();
    }

    public getViewType(): string {
        return WorkbenchItemsListViewType;
    }

    public getDisplayText(): string {
        return 'Pomo Workbench';
    }

    public getIcon(): string {
        return 'dice';
    }

    public onHeaderMenu(menu: Menu): void {
        menu
            .addItem((item) => {
                item
                    .setTitle('Close')
                    .setIcon('cross')
                    .onClick(() => {
                        this.app.workspace.detachLeavesOfType(WorkbenchItemsListViewType);
                    });
            });
    }

    public load(): void {
        super.load();
        //this.registerEvent(this.app.workspace.on('file-open', this.update));
    }

    public readonly redraw = (): void => {
        let activeFile:TFile;
        if(this.plugin.timer.workItem) {
            activeFile = this.plugin.timer.workItem.activeNote;
        }
        const rootEl = createDiv({ cls: 'nav-folder mod-root' });
        const childrenEl = rootEl.createDiv({ cls: 'nav-folder-children' });

        if(this.plugin.settings.active_workbench_path) {
            let workbenchFile:TFile = (this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.active_workbench_path) as TFile)
            const navFile = childrenEl.createDiv({ cls: 'nav-file' });
            const navFileTitle = navFile.createDiv({ cls: 'nav-file-title' });
            if(this.workbench.modified) {
                navFileTitle.createDiv({
                    cls: 'nav-file-title-content',
                    text: '?WORKBENCH: ' + workbenchFile.basename,
                });
            } else {
                navFileTitle.createDiv({
                    cls: 'nav-file-title-content',
                    text: 'WORKBENCH: ' + workbenchFile.basename,
                });

            }
            this.addAttributesToNavFile(navFile, workbenchFile, rootEl);
        }
        if(this.data) {
            this.data.workbenchFiles.forEach((currentFile) => {
                const navFile = childrenEl.createDiv({ cls: 'nav-file' });
                const navFileTitle = navFile.createDiv({ cls: 'nav-file-title' });
                if(activeFile && activeFile.path === currentFile.path) {
                    navFileTitle.createDiv({
                        cls: 'nav-file-title-content',
                        text: '*** ' + currentFile.basename + ' ***',
                    });
                } else {
                    navFileTitle.createDiv({
                        cls: 'nav-file-title-content',
                        text: currentFile.basename,
                    });
                }
                if(this.plugin.opened_file_path && currentFile.path === this.plugin.opened_file_path) {
                    navFileTitle.addClass('red-background');
                }
                this.addAttributesToNavFile(navFile, currentFile, rootEl);
            });
        }
        const contentEl = this.containerEl.children[1];
        contentEl.empty();
        contentEl.appendChild(rootEl);
    };

    private addAttributesToNavFile(navFile: HTMLDivElement, currentFile: FilePath, rootEl: HTMLDivElement) {
        navFile.setAttr('draggable', 'true');
        navFile.addEventListener('dragstart', (event: DragEvent) => {
            const file = this.app.metadataCache.getFirstLinkpathDest(
                currentFile.path,
                '',
            );

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dragManager = (this.app as any).dragManager;
            const dragData = dragManager.dragFile(event, file);
            dragManager.onDragStart(event, dragData);
        });

        navFile.addEventListener('mouseover', (event: MouseEvent) => {
            this.app.workspace.trigger('hover-link', {
                event,
                source: WorkbenchItemsListViewType,
                hoverParent: rootEl,
                targetEl: navFile,
                linktext: currentFile.path,
            });
        });

        navFile.addEventListener('contextmenu', (event: MouseEvent) => {
            const menu = new Menu(this.app);
            const file = this.app.vault.getAbstractFileByPath(currentFile.path);
            this.app.workspace.trigger(
                'file-menu',
                menu,
                file,
                'link-context-menu',
                this.leaf,
            );
            menu.showAtPosition({x: event.clientX, y: event.clientY});
        });

        navFile.addEventListener('click', (event: MouseEvent) => {
            this.focusFile(currentFile, event.ctrlKey || event.metaKey);
        });
    }

    private readonly updateData = async (file: TFile, isActiveNote: boolean): Promise<void> => {
        if (this.data) {
            for (const workbenchFile of this.data.workbenchFiles) {
                if (workbenchFile.path === file.path) {
                    return;
                }
            }
            this.data.workbenchFiles = this.data.workbenchFiles.filter(
                (currFile) => currFile.path !== file.path,
            );
            this.data.workbenchFiles.push({
                basename: file.basename,
                path: file.path,
            });
        }
        await this.workbench.pruneLength(); // Handles the save
    };

    update = async (openedFile: TFile, isForceActiveNote: boolean): Promise<void> => {
        let activeNoteInWorkBench:FilePath;
        let isActiveNote:boolean = false;
        if(!isForceActiveNote) {
            for (const filePath of this.data.workbenchFiles) {
                if (filePath.path === openedFile.path && this.plugin.timer.workItem && this.plugin.timer.workItem.activeNote.path === openedFile.path) {
                    activeNoteInWorkBench = openedFile;
                    isActiveNote = true;
                    break;
                }
            }
        } else {
            isActiveNote = true;
        }

        if(activeNoteInWorkBench) {
            this.data.workbenchFiles.remove(activeNoteInWorkBench);
        }
        if (!openedFile || !this.workbench.shouldAddFile(openedFile)) {
            return;
        }
        await this.updateData(openedFile, isActiveNote);
        this.redraw();
    };

    /**
     * Open the provided file in the most recent leaf.
     *
     * @param shouldSplit Whether the file should be opened in a new split, or in
     * the most recent split. If the most recent split is pinned, this is set to
     * true.
     */
    private readonly focusFile = (file: FilePath, shouldSplit = false): void => {
        const targetFile = this.app.vault
            .getFiles()
            .find((f) => f.path === file.path);

        if (targetFile) {
            let leaf = this.app.workspace.getMostRecentLeaf();

            const createLeaf = shouldSplit || leaf.getViewState().pinned;
            if (createLeaf) {
                leaf = this.app.workspace.createLeafBySplit(leaf);
            }
            leaf.openFile(targetFile);
        } else {
            new Notice('Cannot find a file with that name');
            if(this.data) {
                this.data.workbenchFiles = this.data.workbenchFiles.filter(
                    (fp) => fp.path !== file.path,
                );
            }
            //this.workbench.saveData();
            this.redraw();
        }
    };
}
