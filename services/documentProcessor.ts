
import { DocumentChunk } from '../types';

// Declare external PDF.js for TypeScript
declare const pdfjsLib: any;

export class DocumentProcessor {
  static async processFile(file: File): Promise<DocumentChunk[]> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      return this.processPDF(file);
    } else if (extension === 'csv') {
      return this.processCSV(file);
    }
    
    throw new Error('Unsupported file type. Please upload PDF or CSV.');
  }

  private static async processPDF(file: File): Promise<DocumentChunk[]> {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library not loaded');
    }

    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    return this.chunkText(fullText, file.name);
  }

  private static async processCSV(file: File): Promise<DocumentChunk[]> {
    const text = await file.text();
    // Simple CSV parser - in a real app, use PapaParse
    const rows = text.split('\n');
    const headers = rows[0].split(',');
    
    const content = rows.slice(1)
      .filter(row => row.trim())
      .map((row, idx) => {
        const values = row.split(',');
        return headers.map((h, i) => `${h.trim()}: ${values[i]?.trim()}`).join(' | ');
      })
      .join('\n');

    return this.chunkText(content, file.name);
  }

  private static chunkText(text: string, fileName: string): DocumentChunk[] {
    const CHUNK_SIZE = 1000;
    const chunks: DocumentChunk[] = [];
    
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      chunks.push({
        fileName,
        content: text.substring(i, i + CHUNK_SIZE),
        index: chunks.length
      });
    }
    
    return chunks;
  }

  static findRelevantChunks(query: string, chunks: DocumentChunk[], limit = 5): DocumentChunk[] {
    // Simple keyword-based ranking for demo purposes
    // In a production RAG, this would use semantic vector search
    const queryTerms = query.toLowerCase().split(/\W+/);
    
    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      queryTerms.forEach(term => {
        if (term.length > 2 && contentLower.includes(term)) {
          score += 1;
        }
      });
      return { chunk, score };
    });

    const relevant = scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.chunk);

    // Fallback: If no relevant chunks found by keywords, return the first few chunks
    // This handles cases like "summarize this" or general questions where keywords don't match
    if (relevant.length === 0 && chunks.length > 0) {
      console.log("No keyword matches found. Falling back to first chunks.");
      return chunks.slice(0, limit);
    }

    return relevant;
  }
}
