import {App, FuzzyMatch, FuzzySuggestModal, moment, Notice, TFile, TFolder} from "obsidian";
import { get_tfiles_from_folder } from "src/flexipomosuggesters/Utils";
import { errorWrapperSync } from "src/flexipomosuggesters/Error";
import { log_error } from "src/flexipomosuggesters/Log";
import FlexiblePomoTimerPlugin from "../main";
import {AppHelper} from "./app-helper";
import {WorkItem} from "../workitem";
import {FileUtility} from "../file_utility";
import {FilePath} from "../workbench_data";

export enum OpenMode {
    InsertTemplate,
    CreateNoteTemplate,
}

export class LoadingSuggester extends FuzzySuggestModal<TFile> {
    public app: App;
    private plugin: FlexiblePomoTimerPlugin;
    private open_mode: OpenMode;
    private creation_folder: TFolder;
    private searchQuery: string;
    private appHelper: AppHelper;
    private fileUtility: FileUtility;

    constructor(plugin: FlexiblePomoTimerPlugin) {
        super(plugin.app);
        this.app = plugin.app;
        this.plugin = plugin;
        this.fileUtility = plugin.fileUtility;
        this.appHelper = new AppHelper(this.app);
        this.setPlaceholder("Enter name of workbench...");
        this.setInstructions([
            { command: "[esc]", purpose: "dismiss" },
        ]);
    }

    getSuggestions(query: string): FuzzyMatch<TFile>[] {
        this.searchQuery = query;
        return super.getSuggestions(query);
    }

    getItems(): TFile[] {
        if (!this.plugin.settings.templates_folder) {
            return this.app.vault.getMarkdownFiles();
        }
        const files = errorWrapperSync(
            () =>
                get_tfiles_from_folder(
                    this.app,
                    this.plugin.settings.templates_folder
                ),
            `Couldn't retrieve template files from templates folder ${this.plugin.settings.templates_folder}`
        );
        if (!files) {
            return [];
        }
        return files;
    }

    getItemText(item: TFile): string {
        return item.basename;
    }

    onChooseItem(item: TFile): void {
        if(item && item.path) {
            this.plugin.pomoWorkBench.data.workbenchFiles = new Array<FilePath>();
            this.plugin.pomoWorkBench.modified = false;
            this.plugin.fileUtility.loadItems(item.path, item.basename);
        }
    }

    start(): void {
        try {
            this.open();
        } catch (e) {
            log_error(e);
        }
    }

    insert_template(): void {
        this.open_mode = OpenMode.InsertTemplate;
        this.start();
    }

    create_new_note_from_template(folder?: TFolder): void {
        this.creation_folder = folder;
        this.open_mode = OpenMode.CreateNoteTemplate;
        this.start();
    }



}
