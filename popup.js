document.getElementById("durationSlider").addEventListener("input", function () {
  document.getElementById("durationValue").innerText = this.value;
});

document.getElementById("startExtraction").addEventListener("click", () => {
  const duration = parseInt(document.getElementById("durationSlider").value);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "startSummary", duration }, (response) => {
          if (response && response.transcript) {
              console.log("Extracted subtitles:", response.transcript); // Debugging output
              document.getElementById("capturedSubtitles").innerText = response.transcript || "No subtitles found.";
              summarizeText(response.transcript);
          } else {
              console.error("No subtitles extracted!");
              document.getElementById("capturedSubtitles").innerText = "No subtitles found.";
          }
      });
  });
});


function summarizeText(subtitleText) {
  if (!subtitleText.trim()) {
      document.getElementById("summary").innerText = "No subtitles to summarize.";
      return;
  }

  const formData = new FormData();
  const blob = new Blob([subtitleText], { type: "text/plain" });
  formData.append("file", blob, "subtitles.txt");

  fetch("https://api.apyhub.com/ai/summarize-documents/file", {
      method: "POST",
      headers: { "apy-token": "APY0YGvYtAtixseViWFXJ7YSVQKMqNeIiFw4ltoRSx8X78LXWl1EEUG7WjCJhpydnVH" },
      body: formData
  })
  .then(response => response.json())
  .then(data => {
      document.getElementById("summary").innerText = data.summary || "No summary available.";
  })
  .catch(error => {
      console.error("Error:", error);
      document.getElementById("summary").innerText = "Failed to summarize subtitles.";
  });
}