
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
    const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
    const headers = rows[0].split(',');
    const dataRows = rows.slice(1);
    
    const chunks: DocumentChunk[] = [];
    const ROWS_PER_CHUNK = 30; // Chunk by rows to keep context together

    for (let i = 0; i < dataRows.length; i += ROWS_PER_CHUNK) {
      const chunkRows = dataRows.slice(i, i + ROWS_PER_CHUNK);
      
      const formattedContent = chunkRows.map(row => {
        const values = row.split(',');
        return headers.map((h, idx) => `${h.trim()}: ${values[idx]?.trim()}`).join(' | ');
      }).join('\n');

      chunks.push({
        fileName: file.name,
        content: `[CSV Header: ${headers.join(', ')}]\n${formattedContent}`,
        index: chunks.length
      });
    }

    return chunks;
  }

  private static chunkText(text: string, fileName: string): DocumentChunk[] {
    const CHUNK_SIZE = 4000; // Increased chunk size for better context
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

  static findRelevantChunks(query: string, chunks: DocumentChunk[], limit = 30): DocumentChunk[] {
    // Simple keyword-based ranking
    const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    
    // Detect aggregation/summary intent
    const isAggregation = ['total', 'count', 'sum', 'average', 'summary', 'report', 'analyze', 'overview', 'all'].some(term => 
      query.toLowerCase().includes(term)
    );

    // If aggregation is requested, try to return as much relevant data as possible
    // or if the dataset is small enough, return everything
    if (isAggregation && chunks.length < 50) {
      console.log("Aggregation detected for small dataset. Returning all chunks.");
      return chunks;
    }

    const scoredChunks = chunks.map(chunk => {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      
      // Exact phrase matching bonus
      if (contentLower.includes(query.toLowerCase())) {
        score += 10;
      }

      queryTerms.forEach(term => {
        if (contentLower.includes(term)) {
          score += 1;
        }
      });
      return { chunk, score };
    });

    const relevant = scoredChunks
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, isAggregation ? limit * 2 : limit) // Return more chunks for aggregations
      .map(item => item.chunk);

    // Fallback: If no relevant chunks found by keywords, return the first few chunks
    if (relevant.length === 0 && chunks.length > 0) {
      console.log("No keyword matches found. Falling back to first chunks.");
      // If aggregation, return more fallback chunks
      const fallbackLimit = isAggregation ? 20 : 5;
      return chunks.slice(0, fallbackLimit);
    }

    return relevant;
  }
}
