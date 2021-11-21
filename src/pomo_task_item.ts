

export class PomoTaskItem {
    lineContent: string;
    isCompleted: boolean;
    itemIndex: number;
    parentIndex: number;

    constructor(lineContent: string, isCompleted: boolean, itemIndex: number, parentIndex: number) {
        this.lineContent = lineContent;
        this.isCompleted = isCompleted;
        this.itemIndex = itemIndex;
        this.parentIndex = parentIndex;
    }
}

