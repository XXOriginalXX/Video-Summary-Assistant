chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'summarize') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { action: 'getCaptions' });
        
        if (!response || !response.captions) {
          throw new Error('No captions found. Please ensure captions are enabled on the video.');
        }

        const summarizer = new VideoSummarizer();
        const summary = await summarizer.generateSummary(response.captions);
        
        sendResponse({
          success: true,
          summary: summary
        });
      } catch (error) {
        console.error('Summarization error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    });
    return true;
  }
});