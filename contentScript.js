let captionsObserver = null;
let captions = [];

function startCaptionCollection() {
  captions = [];
  
  if (captionsObserver) {
    captionsObserver.disconnect();
  }

  const captionsContainer = document.querySelector('.ytp-caption-window-container');
  if (!captionsContainer) {
    return false;
  }

  captionsObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const captionElement = mutation.target.querySelector('.ytp-caption-segment');
        if (captionElement && captionElement.textContent.trim()) {
          const captionText = captionElement.textContent.trim();
          if (!captions.includes(captionText)) {
            captions.push(captionText);
          }
        }
      }
    });
  });


  captionsObserver.observe(captionsContainer, {
    childList: true,
    subtree: true
  });

  return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCaptions') {
    if (!captionsObserver) {
      const started = startCaptionCollection();
      if (!started) {
        sendResponse({ 
          error: 'No captions container found. Please ensure captions are enabled.' 
        });
        return true;
      }
    }

    setTimeout(() => {
      if (captions.length === 0) {
        sendResponse({ 
          error: 'No captions found. Please ensure captions are enabled and visible.' 
        });
      } else {
        sendResponse({ 
          captions: captions.join(' ') 
        });
      }
      
      captionsObserver.disconnect();
      captionsObserver = null;
      captions = [];
    }, 5000);

    return true; 
  }
});