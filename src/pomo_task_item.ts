

export class PomoTaskItem {
    lineContent: string;
    isCompleted: boolean;

    constructor(lineContent: string, isCompleted: boolean) {
        this.lineContent = lineContent;
        this.isCompleted = isCompleted;
    }
}

