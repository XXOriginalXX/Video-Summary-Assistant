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

// Enhanced function to get all subtitles using YouTube Data API v3
async function getAllSubtitles() {
  try {
    // Get video ID from URL
    const url = window.location.href;
    const videoId = new URLSearchParams(new URL(url).search).get('v');
    if (!videoId) {
      throw new Error('Could not find video ID');
    }

    // Get OAuth2 token with proper scopes
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: ['https://www.googleapis.com/auth/youtube.force-ssl']
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });

    // First, get the caption tracks
    const captionListResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!captionListResponse.ok) {
      if (captionListResponse.status === 403) {
        // Handle authorization errors
        chrome.identity.removeCachedAuthToken({ token }, () => {});
        throw new Error('Authorization failed. Please try again.');
      }
      throw new Error(`Failed to fetch caption tracks: ${captionListResponse.status}`);
    }

    const captionList = await captionListResponse.json();
    
    if (!captionList.items || captionList.items.length === 0) {
      throw new Error('No captions available for this video');
    }

    // Find English captions (prefer manual over auto-generated)
    const englishCaption = captionList.items.find(
      item => item.snippet.language === 'en' && !item.snippet.trackKind.includes('ASR')
    ) || captionList.items.find(
      item => item.snippet.language === 'en'
    );

    if (!englishCaption) {
      throw new Error('No English captions found');
    }

    // Get the actual caption content
    const captionResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${englishCaption.id}?tfmt=sbv`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/plain'
        }
      }
    );

    if (!captionResponse.ok) {
      if (captionResponse.status === 403) {
        chrome.identity.removeCachedAuthToken({ token }, () => {});
        throw new Error('Authorization failed while fetching captions. Please try again.');
      }
      throw new Error('Failed to fetch caption content');
    }

    const captionText = await captionResponse.text();
    
    // Parse SubViewer format and extract text
    const subtitles = captionText.split('\n\n')
      .map(block => {
        const lines = block.split('\n');
        // Get only the text content (skip timestamp)
        return lines.slice(2).join(' ');
      })
      .join(' ')
      .replace(/\r/g, '') // Remove carriage returns
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    if (!subtitles) {
      throw new Error('No subtitle content found');
    }

    return subtitles;
  } catch (error) {
    console.error('Error getting full subtitles:', error);
    throw error;
  }
}

// Keep the existing message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTranscript') {
    // Enable captions if they're not already enabled
    const captionsButton = document.querySelector('.ytp-subtitles-button');
    if (captionsButton && captionsButton.getAttribute('aria-pressed') === 'false') {
      captionsButton.click();
    }

    // Wait a bit for captions to appear
    setTimeout(() => {
      getVideoTranscript(request.startTime, request.endTime)
        .then(transcript => {
          if (!transcript) {
            console.log('No transcript collected');
            sendResponse({ 
              transcript: null, 
              error: 'No captions found. Please ensure captions are available and enabled for this video.' 
            });
          } else {
            console.log('Collected transcript:', transcript);
            sendResponse({ transcript });
          }
        })
        .catch(error => {
          console.error('Error collecting transcript:', error);
          sendResponse({ 
            transcript: null, 
            error: `Error: ${error.message}. Please ensure captions are enabled and try again.` 
          });
        });
    }, 1000); // Wait 1 second for captions to initialize
    return true;
  }
  
  if (request.action === 'getAllSubtitles') {
    getAllSubtitles()
      .then(transcript => {
        if (!transcript) {
          console.log('No subtitles collected');
          sendResponse({ 
            transcript: null, 
            error: 'No captions available for this video.' 
          });
        } else {
          console.log('Collected full subtitles:', transcript);
          sendResponse({ transcript });
        }
      })
      .catch(error => {
        console.error('Error collecting subtitles:', error);
        sendResponse({ 
          transcript: null, 
          error: `Error: ${error.message}` 
        });
      });
    return true;
  }
});