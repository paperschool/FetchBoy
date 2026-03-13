export interface DragData {
    type: 'folder' | 'request';
    id: string;
    colId: string;
    folderId: string | null;
}

let current: DragData | null = null;

export function setDragData(data: DragData): void {
    current = data;
}

export function getDragData(): DragData | null {
    return current;
}

export function clearDragData(): void {
    current = null;
}
