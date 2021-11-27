import {App, FuzzyMatch, FuzzySuggestModal, moment, Notice, TFile, TFolder} from "obsidian";
import { get_tfiles_from_folder } from "src/flexipomosuggesters/Utils";
import { errorWrapperSync } from "src/flexipomosuggesters/Error";
import { log_error } from "src/flexipomosuggesters/Log";
import FlexiblePomoTimerPlugin from "../main";
import {AppHelper} from "./app-helper";
import {FileUtility} from "../file_utility";

export enum OpenMode {
    InsertTemplate,
    CreateNoteTemplate,
}

export class SavingSuggester extends FuzzySuggestModal<TFile> {
    public app: App;
    private plugin: FlexiblePomoTimerPlugin;
    private open_mode: OpenMode;
    private creation_folder: TFolder;
    private searchQuery: string;
    private appHelper: AppHelper;

    constructor(plugin: FlexiblePomoTimerPlugin) {
        super(plugin.app);
        this.app = plugin.app;
        this.plugin = plugin;
        this.appHelper = new AppHelper(this.app);
        this.setPlaceholder("Type name of a workbench...");
        this.setInstructions([
            { command: "[shift ↵]", purpose: "create" },
            { command: "[esc]", purpose: "dismiss" },
        ]);
        this.scope.register(["Shift"], "Enter", () => {
            if (this.searchQuery) {
                this.plugin.fileUtility.handleCreateNew(this.appHelper, this.searchQuery, false);
                this.close();
            }
        });
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
        switch (this.open_mode) {
            case OpenMode.InsertTemplate:
                 this.plugin.fileUtility.handleAppend(item);
                 this.close();
                //this.plugin.templater.append_template_to_active_file(item);
                break;
            case OpenMode.CreateNoteTemplate:
                console.log('in there');
                //this.plugin.templater.create_new_note_from_template(
                 //   item,
                  //  this.creation_folder
                //);
                break;
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
