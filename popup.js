document.addEventListener('DOMContentLoaded', function() {
  const summarizeButton = document.getElementById('summarize');
  const summaryDiv = document.getElementById('summary');
  const durationSlider = document.getElementById('duration-slider');
  const durationDisplay = document.getElementById('duration-display');
  const videoContainer = document.getElementById('video-container');
  const apiKeyInput = document.getElementById('api-key');
  const saveApiKeyButton = document.getElementById('save-api-key');
  const languageSelect = document.getElementById('language-select');
  const translateButton = document.getElementById('translate');
  const translationControls = document.querySelector('.translation-controls');

  let currentSummary = '';

  // Load saved API key
  chrome.storage.local.get(['apiKey'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save API key
  saveApiKeyButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({ apiKey: apiKey }, function() {
        alert('API key saved successfully!');
      });
    } else {
      alert('Please enter a valid API key');
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
        <strong>Translated Summary (${targetLang === 'ml' ? 'Malayalam' : 'Hindi'}):</strong><br><br>
        ${translatedText}
      `;

      // Remove any previous translations
      const existingTranslation = summaryDiv.querySelector('.translated-text');
      if (existingTranslation) {
        existingTranslation.remove();
      }

      summaryDiv.appendChild(translatedDiv);
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
    // Check if API key is set
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter your Hugging Face API key first');
      return;
    }

    summaryDiv.style.display = 'block';
    translationControls.style.display = 'none';
    summaryDiv.textContent = 'Getting video transcript...';
    currentSummary = '';
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');
      
      if (!videoId) {
        summaryDiv.textContent = 'Please open a YouTube video page.';
        return;
      }

      const duration = parseInt(durationSlider.value);
      
      // Get video transcript for the specified duration
      chrome.tabs.sendMessage(tab.id, { 
        action: 'getTranscript',
        startTime: 0, // This is ignored now as we use current video position
        endTime: duration
      }, async function(response) {
        if (!response || !response.transcript) {
          summaryDiv.textContent = 'Could not get video transcript. Make sure captions are available and try again.';
          return;
        }

        console.log('Received transcript:', response.transcript);

        if (response.transcript.trim().length === 0) {
          summaryDiv.textContent = 'No captions found in the specified duration. Please make sure captions are enabled and try again.';
          return;
        }

        try {
          summaryDiv.textContent = 'Generating summary...';
          const summary = await getSummary(response.transcript, apiKey);
          currentSummary = summary;
          summaryDiv.innerHTML = `
            <strong>Next ${duration} seconds summary:</strong><br><br>${summary}
          `;
          translationControls.style.display = 'block';
        } catch (error) {
          if (error.message.includes('401')) {
            summaryDiv.textContent = 'API Authentication failed. Please check your API key.';
          } else {
            summaryDiv.textContent = 'Error getting summary: ' + error.message;
          }
          translationControls.style.display = 'none';
        }
      });
    } catch (error) {
      summaryDiv.textContent = 'Error: ' + error.message;
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