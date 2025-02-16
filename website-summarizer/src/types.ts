export interface Summary {
  text: string;
  loading: boolean;
  error: string | null;
}

export interface FileState {
  file: File | null;
  url: string;
  type: 'youtube' | 'file' | null;
}