document.addEventListener('DOMContentLoaded', function() {
  const timeRange = document.getElementById('timeRange');
  const timeValue = document.getElementById('timeValue');
  const summarizeButton = document.getElementById('summarize');
  const summaryContainer = document.getElementById('summaryContainer');
  const summaryContent = document.getElementById('summaryContent');
  const status = document.getElementById('status');
  const videoTitle = document.getElementById('videoTitle');
  const thumbnailPlaceholder = document.querySelector('.thumbnail-placeholder');

  // Update time value display when slider moves
  timeRange.addEventListener('input', function() {
    timeValue.textContent = `${this.value}s`;
  });

  // Check if we're on a YouTube video page and get video details
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const url = tabs[0].url;
    if (url && url.includes('youtube.com/watch')) {
      // Extract video ID from URL
      const videoId = new URL(url).searchParams.get('v');
      if (videoId) {
        // Update thumbnail
        thumbnailPlaceholder.innerHTML = `
          <img 
            src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" 
            alt="Video thumbnail"
            style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.5rem;"
          >
        `;
        thumbnailPlaceholder.style.height = 'auto';
        
        // Update title
        videoTitle.textContent = tabs[0].title.replace(' - YouTube', '');
        status.textContent = 'Ready to summarize';
        summarizeButton.disabled = false;
      }
    } else {
      thumbnailPlaceholder.innerHTML = `
        <div class="placeholder-text">No video detected</div>
      `;
      videoTitle.textContent = 'No YouTube video detected';
      status.textContent = 'Please navigate to a YouTube video';
      status.classList.add('error');
      summarizeButton.disabled = true;
    }
  });

  // Handle summarize button click
  summarizeButton.addEventListener('click', function() {
    const seconds = parseInt(timeRange.value);
    
    // Show loading state
    summarizeButton.disabled = true;
    summarizeButton.classList.add('loading');
    status.textContent = 'Collecting video captions...';
    status.classList.remove('error', 'success');
    summaryContainer.style.display = 'block';
    summaryContent.textContent = 'Processing your video...';

    // Send message to background script
    chrome.runtime.sendMessage(
      { 
        action: 'summarize',
        duration: seconds
      },
      function(response) {
        summarizeButton.disabled = false;
        summarizeButton.classList.remove('loading');
        
        if (response && response.success) {
          status.textContent = 'Summary generated successfully';
          status.classList.add('success');
          summaryContent.textContent = response.summary;
        } else {
          status.textContent = 'Error generating summary';
          status.classList.add('error');
          summaryContent.textContent = `Error: ${response.error || 'Unknown error occurred'}`;
        }
      }
    );
  });
});