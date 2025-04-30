export interface FileUploadRequestConfiguration {
    httpMethod: 'PUT' | 'POST';
    signParameters?: Record<string, string> | null;
  }
  
  export interface FileUploadInformation {
    fileId: string;
    uploadUrl: string;
    configuration: FileUploadRequestConfiguration;
  }