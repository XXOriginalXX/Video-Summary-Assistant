document.addEventListener('DOMContentLoaded', function() {
  const summarizeButton = document.getElementById('summarize');
  const summaryDiv = document.getElementById('summary');
  const summaryTitle = document.getElementById('summary-title');
  const summaryContent = document.getElementById('summary-content');
  const durationSlider = document.getElementById('duration-slider');
  const durationDisplay = document.getElementById('duration-display');
  const videoContainer = document.getElementById('video-container');
  const huggingFaceKeyInput = document.getElementById('hugging-face-key');
  const saveHuggingFaceKeyButton = document.getElementById('save-hugging-face-key');
  const youtubeApiKeyInput = document.getElementById('youtube-api-key');
  const saveYoutubeApiKeyButton = document.getElementById('save-youtube-api-key');
  const languageSelect = document.getElementById('language-select');
  const translateButton = document.getElementById('translate');
  const translationControls = document.querySelector('.translation-controls');
  const partialModeButton = document.getElementById('partial-mode');
  const fullModeButton = document.getElementById('full-mode');
  const durationSection = document.getElementById('duration-section');
  const speakButton = document.getElementById('speak-button');

  let currentSummary = '';
  let isPartialMode = true;
  let isSpeaking = false;

  // Text-to-speech functionality
  speakButton.addEventListener('click', function() {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      speakButton.classList.remove('speaking');
      speakButton.querySelector('i').classList.remove('fa-volume-mute');
      speakButton.querySelector('i').classList.add('fa-volume-up');
    } else {
      const textToSpeak = currentSummary;
      if (textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.onend = function() {
          isSpeaking = false;
          speakButton.classList.remove('speaking');
          speakButton.querySelector('i').classList.remove('fa-volume-mute');
          speakButton.querySelector('i').classList.add('fa-volume-up');
        };
        utterance.onerror = function() {
          isSpeaking = false;
          speakButton.classList.remove('speaking');
          speakButton.querySelector('i').classList.remove('fa-volume-mute');
          speakButton.querySelector('i').classList.add('fa-volume-up');
        };
        window.speechSynthesis.speak(utterance);
        isSpeaking = true;
        speakButton.classList.add('speaking');
        speakButton.querySelector('i').classList.remove('fa-volume-up');
        speakButton.querySelector('i').classList.add('fa-volume-mute');
      }
    }
  });

  // Mode switching
  partialModeButton.addEventListener('click', function() {
    isPartialMode = true;
    partialModeButton.classList.add('active');
    fullModeButton.classList.remove('active');
    durationSection.style.display = 'block';
    summarizeButton.textContent = 'Summarize Video';
  });

  fullModeButton.addEventListener('click', function() {
    isPartialMode = false;
    fullModeButton.classList.add('active');
    partialModeButton.classList.remove('active');
    durationSection.style.display = 'none';
    summarizeButton.textContent = 'Get Full Subtitles';
  });

  // Load saved API keys
  chrome.storage.local.get(['huggingFaceKey', 'youtubeApiKey'], function(result) {
    if (result.huggingFaceKey) {
      huggingFaceKeyInput.value = result.huggingFaceKey;
    }
    if (result.youtubeApiKey) {
      youtubeApiKeyInput.value = result.youtubeApiKey;
    }
  });

  // Save Hugging Face API key
  saveHuggingFaceKeyButton.addEventListener('click', function() {
    const apiKey = huggingFaceKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ huggingFaceKey: apiKey }, function() {
        alert('Hugging Face API key saved successfully!');
      });
    } else {
      alert('Please enter a valid Hugging Face API key');
    }
  });

  // Save YouTube API key
  saveYoutubeApiKeyButton.addEventListener('click', function() {
    const apiKey = youtubeApiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ youtubeApiKey: apiKey }, function() {
        alert('YouTube API key saved successfully!');
      });
    } else {
      alert('Please enter a valid YouTube API key');
    }
  });

  // Update duration display when slider changes
  durationSlider.addEventListener('input', function() {
    durationDisplay.textContent = this.value;
  });

  // Load saved duration
  chrome.storage.local.get(['duration'], function(result) {
    if (result.duration) {
      durationSlider.value = result.duration;
      durationDisplay.textContent = result.duration;
    }
  });

  // Save duration when changed
  durationSlider.addEventListener('change', function() {
    chrome.storage.local.set({ duration: this.value });
  });

  // Translation function using MyMemory API
  async function translateText(text, targetLang) {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`
      );

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      
      if (data.responseStatus === 200) {
        return data.responseData.translatedText;
      } else {
        throw new Error(data.responseMessage || 'Translation failed');
      }
    } catch (error) {
      throw new Error(`Translation error: ${error.message}`);
    }
  }

  // Handle translation button click
  translateButton.addEventListener('click', async function() {
    const targetLang = languageSelect.value;
    if (!targetLang) {
      alert('Please select a language for translation');
      return;
    }

    if (!currentSummary) {
      alert('Please generate a summary first');
      return;
    }

    try {
      translateButton.disabled = true;
      translateButton.textContent = 'Translating...';

      const translatedText = await translateText(currentSummary, targetLang);
      
      // Add translated text to summary div
      const translatedDiv = document.createElement('div');
      translatedDiv.className = 'translated-text';
      translatedDiv.innerHTML = `
        <strong>Translated Summary:</strong><br><br>
        ${translatedText}
      `;

      // Remove any previous translations
      const existingTranslation = summaryContent.querySelector('.translated-text');
      if (existingTranslation) {
        existingTranslation.remove();
      }

      summaryContent.appendChild(translatedDiv);
    } catch (error) {
      alert(error.message);
    } finally {
      translateButton.disabled = false;
      translateButton.textContent = 'Translate Summary';
    }
  });

  // Function to update video information
  async function updateVideoInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');

      if (!videoId) {
        videoContainer.innerHTML = `
          <div class="no-video">
            Please open a YouTube video page
          </div>
        `;
        summarizeButton.disabled = true;
        return;
      }

      // Get video details from YouTube
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch video details');
      }
      
      const data = await response.json();

      videoContainer.innerHTML = `
        <div class="video-info">
          <img src="${thumbnailUrl}" alt="Video thumbnail" class="thumbnail">
          <div class="video-details">
            <h2 class="video-title">${data.title}</h2>
          </div>
        </div>
      `;
      summarizeButton.disabled = false;
    } catch (error) {
      videoContainer.innerHTML = `
        <div class="no-video">
          Error loading video information: ${error.message}
        </div>
      `;
      summarizeButton.disabled = true;
    }
  }

  // Update video info when popup opens
  updateVideoInfo();

  summarizeButton.addEventListener('click', async function() {
    // Check if required API keys are set
    const huggingFaceKey = huggingFaceKeyInput.value.trim();
    const youtubeApiKey = youtubeApiKeyInput.value.trim();
    
    if (!huggingFaceKey) {
      alert('Please enter your Hugging Face API key first');
      return;
    }
    
    if (!youtubeApiKey && !isPartialMode) {
      alert('Please enter your YouTube API key for full subtitles feature');
      return;
    }

    // Stop any ongoing speech
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      speakButton.classList.remove('speaking');
      speakButton.querySelector('i').classList.remove('fa-volume-mute');
      speakButton.querySelector('i').classList.add('fa-volume-up');
    }

    summaryDiv.style.display = 'block';
    translationControls.style.display = 'none';
    summaryTitle.textContent = isPartialMode ? 'Next few seconds summary:' : 'Full Video Subtitles:';
    summaryContent.textContent = isPartialMode ? 'Getting video transcript...' : 'Getting full subtitles...';
    currentSummary = '';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, { 
        action: isPartialMode ? 'getTranscript' : 'getAllSubtitles',
        startTime: 0,
        endTime: parseInt(durationSlider.value),
        youtubeApiKey: youtubeApiKey
      }, async function(response) {
        if (!response || !response.transcript) {
          summaryContent.textContent = response?.error || 'Could not get video transcript. Make sure captions are available and try again.';
          return;
        }

        if (response.transcript.trim().length === 0) {
          summaryContent.textContent = 'No captions found. Please make sure captions are enabled and try again.';
          return;
        }

        if (isPartialMode) {
          try {
            summaryContent.textContent = 'Generating summary...';
            const summary = await getSummary(response.transcript, huggingFaceKey);
            currentSummary = summary;
            summaryContent.textContent = summary;
            translationControls.style.display = 'block';
          } catch (error) {
            if (error.message.includes('401')) {
              summaryContent.textContent = 'API Authentication failed. Please check your Hugging Face API key.';
            } else {
              summaryContent.textContent = 'Error getting summary: ' + error.message;
            }
            translationControls.style.display = 'none';
          }
        } else {
          currentSummary = response.transcript;
          summaryContent.textContent = response.transcript;
          translationControls.style.display = 'block';
        }
      });
    } catch (error) {
      summaryContent.textContent = 'Error: ' + error.message;
      translationControls.style.display = 'none';
    }
  });
});

async function getSummary(transcript, apiKey) {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          inputs: transcript,
          parameters: {
            max_length: 150,
            min_length: 30,
          }
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 401) {
        throw new Error('401: Unauthorized - Invalid API key');
      }
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result[0].summary_text;
  } catch (error) {
    throw error;
  }
}