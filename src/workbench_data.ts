export interface FilePath {
    path: string;
    basename: string;
}

export interface WorkbenchFilesData {
    workbenchFiles: FilePath[];
    omittedPaths: string[];
    maxLength: number;
}

export const defaultMaxLength: number = 50;

export const DEFAULT_DATA: WorkbenchFilesData = {
    workbenchFiles: [],
    omittedPaths: [],
    maxLength: null,
};

export const WorkbenchItemsListViewType = 'workbench-items';
