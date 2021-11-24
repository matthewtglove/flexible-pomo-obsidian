import {ItemView, Menu, Notice, TFile, WorkspaceLeaf,} from 'obsidian';

import PomoTimerPlugin from "./main";
import {FilePath, WorkbenchFilesData, WorkbenchItemsListViewType} from "./workbench_data";
import FlexiblePomoWorkbench from "./workbench";
import {Mode} from "./timer";


export class WorkbenchItemsListView extends ItemView {
    private readonly plugin: PomoTimerPlugin;
    private data: WorkbenchFilesData;
    private workbench: FlexiblePomoWorkbench;

    constructor(
        leaf: WorkspaceLeaf,
        plugin: PomoTimerPlugin,
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
        const openFile = this.app.workspace.getActiveFile();
        const rootEl = createDiv({ cls: 'nav-folder mod-root' });
        const childrenEl = rootEl.createDiv({ cls: 'nav-folder-children' });
        const activeNavFile = childrenEl.createDiv({ cls: 'nav-file' });
        const activeNavFileTitle = activeNavFile.createDiv({ cls: 'nav-file-title' });
        if(this.plugin.timer.workItem.activeNote && this.plugin.timer.mode === Mode.Pomo) {
            activeNavFileTitle.createDiv({
                cls: 'nav-file-title-content',
                text: '*** ' + this.plugin.timer.workItem.activeNote.basename + ' ***',
            });
            this.addAttributesToNavFile(activeNavFile, this.plugin.timer.workItem.activeNote as FilePath, rootEl);
        }
        if(this.data) {
            this.data.workbenchFiles.forEach((currentFile) => {
                const navFile = childrenEl.createDiv({ cls: 'nav-file' });
                const navFileTitle = navFile.createDiv({ cls: 'nav-file-title' });
                /*
                if (openFile && currentFile.path === openFile.path) {
                    navFileTitle.addClass('is-active');
                }
                */
                navFileTitle.createDiv({
                    cls: 'nav-file-title-content',
                    text: currentFile.basename,
                });
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

    private readonly updateData = async (file: TFile): Promise<void> => {
        if(this.data) {
            this.data.workbenchFiles = this.data.workbenchFiles.filter(
                (currFile) => currFile.path !== file.path,
            );
            this.data.workbenchFiles.unshift({
                basename: file.basename,
                path: file.path,
            });
        }

        await this.workbench.pruneLength(); // Handles the save
    };

    update = async (openedFile: TFile): Promise<void> => {
        if (!openedFile || !this.workbench.shouldAddFile(openedFile)) {
            return;
        }
        await this.updateData(openedFile);
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
