

export class PomoTaskItem {
    lineContent: string;
    isCompleted: boolean;
    filePath: string;

    constructor(lineContent: string, isCompleted: boolean, filePath: string) {
        this.lineContent = lineContent;
        this.isCompleted = isCompleted;
        this.filePath = filePath;
    }
}

