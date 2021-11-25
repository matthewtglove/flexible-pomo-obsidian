import {addIcon, MarkdownView, Notice, Plugin, WorkspaceLeaf} from 'obsidian';
import * as feather from 'feather-icons'; //import just icons I want?
import { PomoSettingTab, PomoSettings, DEFAULT_SETTINGS } from './settings';
import { getDailyNoteFile, Mode, Timer } from './timer';
import FlexiblePomoWorkbench from "./workbench";
import {DEFAULT_DATA, FilePath, WorkbenchItemsListViewType} from "./workbench_data";
import {ParseUtility} from "./parse_utility";
import {WorkItem} from "./workitem";
import {WorkbenchItemsListView} from "./workbench_view";


export default class PomoTimerPlugin extends Plugin {
	settings: PomoSettings;
	statusBar: HTMLElement;
	timer: Timer;
	pomoWorkBench: FlexiblePomoWorkbench;
	parseUtility: ParseUtility;

	async onload() {
		console.log('Loading status bar pomodoro timer');

		await this.loadSettings();
		this.addSettingTab(new PomoSettingTab(this.app, this));
		this.statusBar = this.addStatusBarItem();
		this.statusBar.addClass("statusbar-pomo");
		if (this.settings.logging === true) {
			this.openLogFileOnClick();
		}
		this.timer = new Timer(this);
		/*Adds icon to the left side bar which starts the pomo timer when clicked
		  if no timer is currently running, and otherwise quits current timer*/
		if (this.settings.ribbonIcon === true) {
			this.addRibbonIcon('clock', 'Start pomodoro', () => {
				this.timer.onRibbonIconClick();
			});
		}

		//addIcon('sweep', sweepIcon);
		this.pomoWorkBench = new FlexiblePomoWorkbench(this.app.workspace.activeLeaf, this, DEFAULT_DATA);
		this.registerView(
			WorkbenchItemsListViewType,
			//TODO : Fix this
			(leaf) => (this.pomoWorkBench.view = new WorkbenchItemsListView(leaf, this, this.pomoWorkBench.data, this.pomoWorkBench)),
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(this.app.workspace as any).registerHoverLinkSource(
			WorkbenchItemsListViewType,
			{
				display: 'Pomo Workbench',
				defaultMod: true,
			},
		);
		if (this.app.workspace.layoutReady) {
			await this.pomoWorkBench.initView();
		} else {
			this.registerEvent(this.app.workspace.on('quit', this.pomoWorkBench.initView));
		}
		//this.registerEvent(this.app.vault.on('rename', this.handleRename));
		//this.registerEvent(this.app.vault.on('delete', this.handleDelete));


		/*Update status bar timer ever half second
		  Ideally should change so only updating when in timer mode
		  - regular conditional doesn't remove after quit, need unload*/
		this.registerInterval(window.setInterval(async () =>
			this.statusBar.setText(await this.timer.setStatusBarText()), 500));

		addIcon("feather-play", feather.icons.play.toString());
		addIcon("feather-pause", feather.icons.pause.toString());
		addIcon("feather-quit", feather.icons.x.toSvg({viewBox: "0 0 24 24", width: "100", height: "100"}).toString()); //https://github.com/phibr0/obsidian-customizable-sidebar/blob/master/src/ui/icons.ts
		addIcon("feather-headphones", feather.icons.headphones.toString());

		this.addCommand({
			id: 'start-flexible-pomo',
			name: 'Start Pomodoro',
			icon: 'feather-play',
			callback: () => {
				this.timer = new Timer(this);
				this.timer.triggered = false;
				this.timer.startTimer(Mode.Pomo);
				this.showWorkbench();
			}
		});

		this.addCommand({
			id: 'log-and-quit-flexible-pomo',
			name: 'Log Pomodoro Time and Quit.',
			icon: 'feather-log-and-quit',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode === Mode.Pomo && this.settings.logging) {
					if (!checking) {
						this.timer.extendPomodoroTime = false;
						this.timer.triggered = false;
						this.timer.stopTimerEarly();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'open-activenote-flexible-pomo',
			name: 'Open Active Note',
			icon: 'feather-open-active-note',
			checkCallback: (checking: boolean) => {
				if (this.timer.workItem && this.timer.workItem.activeNote && this.timer.mode === Mode.Pomo) {
					if (!checking) {
						let view = this.app.workspace.getActiveViewOfType(MarkdownView)
						if ( view ) {
							let file = view.file;
							if(file.basename !== this.timer.workItem.activeNote.basename) {
								let rightLeaf = this.app.workspace.splitActiveLeaf('vertical')
								this.app.workspace.setActiveLeaf(rightLeaf)
								rightLeaf.openFile(this.timer.workItem.activeNote);
							}
						}
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'start-flexible-pomo-shortbreak',
			name: 'Start Short Break',
			icon: 'feather-play',
			callback: () => {
				this.timer.startTimer(Mode.ShortBreak);
			}
		})

		this.addCommand({
			id: 'start-flexible-pomo-longbreak',
			name: 'Start Long Break',
			icon: 'feather-play',
			callback: () => {
				this.timer.startTimer(Mode.LongBreak);
			}
		})

		this.addCommand({
			id: 'pause-flexible-pomo',
			name: 'Toggle timer pause',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.togglePause();
					}
					return true;
				}
				return false;
			},
			icon: 'feather-pause'
		});

		this.addCommand({
			id: 'quit-flexible-pomo',
			name: 'Quit timer',
			icon: 'feather-quit',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode !== Mode.NoTimer) {
					if (!checking) {
						this.timer.quitTimer();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'link-file-pomoworkbench',
			name: 'Link File To Active WorkBench',
			icon: 'feather-add',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode !== Mode.NoTimer && (this.timer.workItem && this.timer.workItem.activeNote && this.app.workspace.getActiveFile() && (this.timer.workItem.activeNote.path !== this.app.workspace.getActiveFile().path))) {
					if(this.checkIfActive()) {
						return false;
					}
					if (!checking) {
						this.pomoWorkBench.linkFile(this.app.workspace.getActiveFile(), null);
						this.showWorkbench();
						new Notice('Linking Active Note to Workbench');
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'unlink-file-pomoworkbench',
			name: 'Unlink File From Active Workbench',
			icon: 'feather-remove',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode !== Mode.NoTimer && (this.timer.workItem && this.timer.workItem.activeNote && this.app.workspace.getActiveFile() && (this.timer.workItem.activeNote.path !== this.app.workspace.getActiveFile().path))) {
					if(!this.checkIfActive()) {
						return false;
					}
					if (!checking) {
						let workItemToRemove:WorkItem;
						for(const currentItem of this.pomoWorkBench.workItems) {
							if(currentItem.activeNote.path === this.app.workspace.getActiveFile().path) {
								workItemToRemove = currentItem;
								break;
							}
						}
						if(workItemToRemove) {
							this.pomoWorkBench.unlinkItem(workItemToRemove);
							new Notice('Unlinking Active Note From Workbench');
						}
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'show-pomoworkbench',
			name: 'Show Pomo Workbench',
			icon: 'feather-show',
			checkCallback: (checking: boolean) => {
				if (this.timer.mode === Mode.Pomo) {
					if (!checking) {
						this.showWorkbench();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'clear-pomoworkbench',
			name: 'Clear Pomo Workbench',
			icon: 'feather-clear',
			callback: () => {
				this.pomoWorkBench.clearWorkBench();
			}
		});

		this.addCommand({
			id: 'toggle-flexible-pomo-white-noise',
			name: 'Toggle White noise',
			icon: 'feather-headphones',
			callback: () => {
				if (this.settings.whiteNoise) {
					this.settings.whiteNoise = false;
					this.timer.whiteNoisePlayer.stopWhiteNoise();
				} else {
					this.settings.whiteNoise = true;
					this.timer.whiteNoisePlayer.whiteNoise();
				}
			}
		});

		this.parseUtility = new ParseUtility(this);
	}

	private  async showWorkbench() {
		if (this.app.workspace.getLeavesOfType(WorkbenchItemsListViewType).length) {
			await this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(WorkbenchItemsListViewType).first());
		} else {
			 await this.app.workspace.getRightLeaf(false).setViewState({
				type: WorkbenchItemsListViewType,
			})
			await this.app.workspace.revealLeaf(this.app.workspace.getLeavesOfType(WorkbenchItemsListViewType).first());
		}
	}

	private checkIfActive():boolean {
		if (this.pomoWorkBench && this.pomoWorkBench.workItems.length) {
			for (const currentItem of this.pomoWorkBench.workItems) {
				if (currentItem.activeNote.path === this.app.workspace.getActiveFile().path) {
					return true;
				}
			}
			return false;
		}
	}

//on click, open log file; from Day Planner https://github.com/lynchjames/obsidian-day-planner/blob/c8d4d33af294bde4586a943463e8042c0f6a3a2d/src/status-bar.ts#L53
	openLogFileOnClick() {
		this.statusBar.addClass("statusbar-pomo-logging");
		this.statusBar.onClickEvent(async (ev: any) => {
			if (this.settings.logging === true) { //this is hacky, ideally I'd just unwatch the onClickEvent as soon as I turned logging off
				try {
					var file: string;
					if (this.settings.logToDaily === true) {
						file = (await getDailyNoteFile()).path;
					} else {
						file = this.settings.logFile;
					}
					this.app.workspace.openLinkText(file, '', false);
				} catch (error) {
					console.log(error);
				}
			}
		});
	}

	/**************  Meta  **************/

	onunload() {
		this.timer.quitTimer();
		(this.app.workspace as any).unregisterHoverLinkSource(
			WorkbenchItemsListViewType,
		);
		console.log('Unloading status bar pomodoro timer');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}