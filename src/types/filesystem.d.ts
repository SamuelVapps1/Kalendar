// File System Access API type definitions

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>;
}
