let videoElement = null;
let transcriptText = '';
let isInitialized = false;

function initialize() {
  if (isInitialized) return;
  
  videoElement = document.querySelector('video');
  if (!videoElement) {
    setTimeout(initialize, 1000);
    return;
  }
  
  isInitialized = true;
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSummary') {
      startRecording(request.duration, sendResponse);
      return true;
    }
  });
}

function startRecording(duration, sendResponse) {
  if (!videoElement) {
    sendResponse({ transcript: "No video found." });
    return;
  }

  transcriptText = '';
  const captionsContainer = document.querySelector('.ytp-caption-window-container');
  if (!captionsContainer) {
    sendResponse({ transcript: "No captions found. Please enable CC." });
    return;
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'characterData' && mutation.target.textContent) {
        transcriptText += mutation.target.textContent.trim() + ' ';
      }
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          transcriptText += node.textContent.trim() + ' ';
        }
      });
    });
  });

  observer.observe(captionsContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });

  videoElement.play();

  setTimeout(() => {
    videoElement.pause();
    observer.disconnect();
    sendResponse({ transcript: transcriptText.trim() || "No subtitles recorded." });
  }, duration * 1000);
}

initialize();
