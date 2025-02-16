// Function to get video transcript within time range
function getVideoTranscript(startTime, endTime) {
  // Get all caption elements
  const captionWindow = document.querySelector('.ytp-caption-window-container');
  if (!captionWindow) {
    console.log('No caption window found');
    return null;
  }

  // Get current video element
  const video = document.querySelector('video');
  if (!video) {
    console.log('No video element found');
    return null;
  }

  // Get the current video time as the start time
  const currentTime = video.currentTime;
  const wasPlaying = !video.paused;
  if (wasPlaying) {
    video.pause();
  }

  // Calculate the end time based on the duration parameter
  const calculatedEndTime = currentTime + endTime;

  // Initialize transcript collection
  let transcript = '';
  let currentPosition = currentTime;

  // Function to collect captions at a specific time
  const collectCaptionsAt = (time) => {
    video.currentTime = time;
    // Wait for captions to update
    return new Promise(resolve => {
      setTimeout(() => {
        const captions = document.querySelectorAll('.ytp-caption-segment');
        let text = '';
        captions.forEach(caption => {
          text += caption.textContent + ' ';
        });
        resolve(text.trim());
      }, 100); // Wait 100ms for captions to appear
    });
  };

  // Return promise that collects all captions
  return new Promise(async (resolve) => {
    // Collect captions every second within the time range
    while (currentPosition <= calculatedEndTime) {
      const captionText = await collectCaptionsAt(currentPosition);
      if (captionText) {
        transcript += captionText + ' ';
      }
      currentPosition += 1; // Move forward 1 second
    }

    // Restore video to original state
    video.currentTime = currentTime;
    if (wasPlaying) {
      video.play();
    }

    // Clean up transcript by removing duplicate phrases and extra spaces
    const cleanTranscript = transcript
      .split(' ')
      .filter((word, index, array) => array.indexOf(word) === index) // Remove duplicate words
      .join(' ')
      .replace(/\s+/g, ' ') // Remove extra spaces
      .trim();

    resolve(cleanTranscript);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    // Get transcript and send response
    getVideoTranscript(request.startTime, request.endTime)
      .then(transcript => {
        if (!transcript) {
          console.log('No transcript collected');
          sendResponse({ transcript: null });
        } else {
          console.log('Collected transcript:', transcript);
          sendResponse({ transcript });
        }
      })
      .catch(error => {
        console.error('Error collecting transcript:', error);
        sendResponse({ transcript: null });
      });
    return true; // Keep the message channel open for async response
  }
});