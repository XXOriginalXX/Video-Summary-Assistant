import axios from 'axios';

const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY;
const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export async function getYouTubeTranscript(videoId: string) {
  try {
    // Get video details for better context
    const videoResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const videoDetails = videoResponse.data.items[0];
    const snippet = videoDetails.snippet;
    const statistics = videoDetails.statistics;

    const videoTitle = snippet.title;
    const videoDescription = snippet.description;
    const channelTitle = snippet.channelTitle;
    const publishedAt = new Date(snippet.publishedAt).toLocaleDateString();
    const viewCount = parseInt(statistics.viewCount).toLocaleString();
    const likeCount = parseInt(statistics.likeCount).toLocaleString();

    // Get captions
    const captionsResponse = await axios.get(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!captionsResponse.data.items || captionsResponse.data.items.length === 0) {
      throw new Error('No captions found for this video');
    }

    // Combine video information with captions for better context
    return `Title: ${videoTitle}\n\n` +
           `Channel: ${channelTitle}\n` +
           `Published: ${publishedAt}\n` +
           `Views: ${viewCount}\n` +
           `Likes: ${likeCount}\n\n` +
           `Description:\n${videoDescription}`;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error('YouTube API quota exceeded or invalid API key');
      }
      throw new Error(`YouTube API error: ${error.message}`);
    }
    throw error;
  }
}

export async function getSummary(text: string) {
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      {
        inputs: text,
        parameters: {
          max_length: 300, // Increased for even more detailed summaries
          min_length: 100, // Increased minimum length
          do_sample: true,
          temperature: 0.8, // Slightly increased for more creative summaries
          num_beams: 5, // Increased for better text generation
          no_repeat_ngram_size: 3, // Prevent repetition of phrases
          length_penalty: 1.5, // Encourage slightly longer summaries
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        },
      }
    );

    if (!response.data || !response.data[0]?.summary_text) {
      throw new Error('Invalid response from summarization API');
    }

    return response.data[0].summary_text;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Hugging Face API key');
      }
      throw new Error(`Summarization API error: ${error.message}`);
    }
    throw error;
  }
}

export async function transcribeAudio(audioFile: File) {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      formData,
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        },
      }
    );

    if (!response.data || !response.data.text) {
      throw new Error('Invalid response from transcription API');
    }

    return response.data.text;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Hugging Face API key');
      } else if (error.response?.status === 413) {
        throw new Error('File too large. Please use a smaller file.');
      }
      throw new Error(`Transcription API error: ${error.message}`);
    }
    throw error;
  }
}