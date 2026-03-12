const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * PDF Extractor Service
 * Extracts text content from PDF files
 */

class PDFExtractorService {
  /**
   * Extract text from PDF file
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<object>} Extracted data
   */
  async extractText(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      return {
        text: pdfData.text,
        pages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata,
        version: pdfData.version
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Clean and preprocess extracted text
   * @param {string} text - Raw extracted text
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters that might interfere with parsing
      .replace(/[^\x00-\x7F]/g, '')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      // Remove multiple consecutive newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract text and clean it
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<string>} Cleaned text
   */
  async extractAndClean(filePath) {
    const extracted = await this.extractText(filePath);
    return this.cleanText(extracted.text);
  }

  /**
   * Validate if file is a valid PDF
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if valid PDF
   */
  async isValidPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // Check PDF magic number
      const header = dataBuffer.toString('utf8', 0, 5);
      return header === '%PDF-';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new PDFExtractorService();
