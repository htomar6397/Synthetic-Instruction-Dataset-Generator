import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * Clean text content by removing excess whitespace, HTML elements, and formatting noise.
 */
export function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/<[^>]+>/g, ' ') // Strip HTML tags
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/\n\s*\n/g, '\n') // Collapse empty lines
    .trim();
}

/**
 * Split text into chunks recursively with overlap.
 */
export function chunkText(text: string, options: ChunkOptions): string[] {
  const { chunkSize, chunkOverlap } = options;
  const cleanedText = cleanText(text);

  if (cleanedText.length <= chunkSize) {
    return [cleanedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < cleanedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < cleanedText.length) {
      // Try to find a natural boundary (paragraph end, period, space) to avoid cutting words/sentences
      const boundarySearchArea = cleanedText.slice(Math.max(startIndex, endIndex - 100), Math.min(cleanedText.length, endIndex + 20));
      const paragraphBreak = boundarySearchArea.lastIndexOf('\n');
      const sentenceBreak = Math.max(
        boundarySearchArea.lastIndexOf('. '),
        boundarySearchArea.lastIndexOf('? '),
        boundarySearchArea.lastIndexOf('! ')
      );
      const spaceBreak = boundarySearchArea.lastIndexOf(' ');

      let relativeBreak = -1;
      if (paragraphBreak !== -1) {
        relativeBreak = paragraphBreak;
      } else if (sentenceBreak !== -1) {
        relativeBreak = sentenceBreak + 1; // Include punctuation
      } else if (spaceBreak !== -1) {
        relativeBreak = spaceBreak;
      }

      if (relativeBreak !== -1) {
        const offset = Math.max(startIndex, endIndex - 100);
        endIndex = offset + relativeBreak + 1;
      }
    }

    chunks.push(cleanedText.slice(startIndex, endIndex).trim());
    startIndex = endIndex - chunkOverlap;

    // Safety fallback to prevent infinite loop
    if (chunkOverlap >= chunkSize || startIndex >= endIndex) {
      startIndex = endIndex;
    }
  }

  return chunks.filter(c => c.length > 10); // filter out tiny chunks
}

/**
 * Extract text from a URL using axios and cheerio.
 */
export async function scrapeUrl(url: string): Promise<string> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 10000
  });

  const $ = cheerio.load(response.data);

  // Remove elements that are noise
  $('nav, footer, script, style, header, iframe, noscript, .ads, #sidebar, .sidebar').remove();

  // Prefer main article text, fallback to body
  const bodyElement = $('article, main, .main, #content, body');
  let text = '';

  if (bodyElement.length > 0) {
    text = $(bodyElement.first()).text();
  } else {
    text = $('body').text();
  }

  return cleanText(text);
}

/**
 * Extract text from a PDF Buffer using pdf-parse.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}
