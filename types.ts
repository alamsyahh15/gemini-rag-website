
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  sources?: string[];
}

export interface DocumentChunk {
  fileName: string;
  content: string;
  index: number;
}

export interface KnowledgeBase {
  chunks: DocumentChunk[];
  fileNames: string[];
}

export interface ProcessedFile {
  name: string;
  type: string;
  content: string;
}
