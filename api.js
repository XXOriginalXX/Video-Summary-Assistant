import config from './config.js';

class VideoSummarizer {
  constructor() {
    this.apyhubKey = config.APYHUB_API_KEY;
    this.apyhubUrl = config.APYHUB_API_URL;
  }

  async generateSummary(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Cannot summarize empty text. Please ensure the video has captions.');
      }
      const processedText = text.trim();
      const blob = new Blob([processedText], { type: 'text/plain' });
      if (blob.size === 0) {
        throw new Error('Generated file is empty. Please ensure the video has valid captions.');
      }
      const formData = new FormData();
      formData.append('file', blob, 'transcript.txt');

      const response = await fetch(this.apyhubUrl, {
        method: 'POST',
        headers: {
          'apy-token': this.apyhubKey
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error Response:', errorData);
        throw new Error(`API request failed with status ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      
      if (!result.data) {
        throw new Error('No summary data received from API');
      }

      return result.data;
    } catch (error) {
      console.error('Error details:', error);
      throw error;
    }
  }
}

export default VideoSummarizer;