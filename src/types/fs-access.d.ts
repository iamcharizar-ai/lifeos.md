// Minimal File System Access API declarations (Chromium; not in lib.dom yet)
interface Window {
  showDirectoryPicker(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: string
  }): Promise<FileSystemDirectoryHandle>
}

interface FileSystemHandle {
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
}
