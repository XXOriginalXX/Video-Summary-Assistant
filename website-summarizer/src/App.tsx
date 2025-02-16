import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, Youtube, AlertCircle, Play, Clock, FileVideo, Sparkles } from 'lucide-react';
import { getYouTubeTranscript, getSummary, transcribeAudio } from './api';
import type { Summary, FileState } from './types';

function App() {
  const [file, setFile] = useState<FileState>({
    file: null,
    url: '',
    type: null,
  });
  const [summary, setSummary] = useState<Summary>({
    text: '',
    loading: false,
    error: null,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setFile({
        file,
        url: URL.createObjectURL(file),
        type: 'file',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav'],
      'video/*': ['.mp4', '.webm'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
  });

  const extractVideoId = (url: string): string => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === 'youtube.com' || urlObj.hostname === 'www.youtube.com') {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;
      }
      
      if (urlObj.hostname === 'youtu.be') {
        const videoId = urlObj.pathname.slice(1);
        if (videoId) return videoId;
      }
      
      if (urlObj.hostname === 'youtube.com' || urlObj.hostname === 'www.youtube.com') {
        if (urlObj.pathname.startsWith('/embed/')) {
          const videoId = urlObj.pathname.split('/')[2];
          if (videoId) return videoId;
        }
      }
      
      throw new Error('Could not extract video ID from URL');
    } catch (error) {
      throw new Error('Please enter a valid YouTube URL');
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile({
      file: null,
      url: e.target.value,
      type: 'youtube',
    });
    if (summary.error) {
      setSummary(prev => ({ ...prev, error: null }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSummary({ text: '', loading: true, error: null });

    try {
      let text = '';

      if (file.type === 'youtube') {
        try {
          const videoId = extractVideoId(file.url);
          text = await getYouTubeTranscript(videoId);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`YouTube error: ${error.message}`);
          }
          throw error;
        }
      } else if (file.type === 'file' && file.file) {
        try {
          text = await transcribeAudio(file.file);
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Transcription error: ${error.message}`);
          }
          throw error;
        }
      } else {
        throw new Error('Please provide a YouTube URL or upload a file');
      }

      const summaryText = await getSummary(text);
      setSummary({ text: summaryText, loading: false, error: null });
    } catch (error) {
      setSummary({
        text: '',
        loading: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  const resetForm = () => {
    setFile({ file: null, url: '', type: null });
    setSummary({ text: '', loading: false, error: null });
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white pb-12">
      {/* Header */}
      <header className="bg-[#282828] py-4 px-6 mb-8">
        <div className="max-w-5xl mx-auto flex items-center space-x-2">
          <Play className="h-8 w-8 text-red-600 fill-current" />
          <h1 className="text-2xl font-bold">Smart Video Summarizer</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4">
        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#282828] p-6 rounded-lg">
            <Clock className="h-8 w-8 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Save Time</h3>
            <p className="text-gray-400">Get concise summaries of long videos in seconds</p>
          </div>
          <div className="bg-[#282828] p-6 rounded-lg">
            <FileVideo className="h-8 w-8 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Multiple Formats</h3>
            <p className="text-gray-400">Support for YouTube videos and local media files</p>
          </div>
          <div className="bg-[#282828] p-6 rounded-lg">
            <Sparkles className="h-8 w-8 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI-Powered</h3>
            <p className="text-gray-400">Advanced AI technology for accurate summaries</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-[#282828] rounded-lg shadow-xl p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-medium mb-2">
                YouTube URL
              </label>
              <div className="flex rounded-md shadow-sm">
                <span className="inline-flex items-center px-4 rounded-l-md border border-r-0 border-gray-700 bg-[#1F1F1F] text-gray-400">
                  <Youtube className="h-5 w-5" />
                </span>
                <input
                  type="url"
                  value={file.url}
                  onChange={handleUrlChange}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="flex-1 min-w-0 block w-full px-4 py-3 rounded-none rounded-r-md border border-gray-700 bg-[#1F1F1F] text-white placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Supports youtube.com, youtu.be, and embedded URLs
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#282828] text-gray-400">OR</span>
              </div>
            </div>

            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive ? 'border-red-500 bg-[#1F1F1F]' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg mb-2">Drag and drop your media file here</p>
              <p className="text-sm text-gray-400">MP3, WAV, MP4 up to 25MB</p>
            </div>

            {file.file && (
              <div className="flex items-center space-x-2 text-gray-400 bg-[#1F1F1F] p-3 rounded-md">
                <FileText className="h-5 w-5" />
                <span>{file.file.name}</span>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={(!file.url && !file.file) || summary.loading}
                className="flex-1 py-3 px-6 rounded-md font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                {summary.loading ? 'Processing...' : 'Generate Summary'}
              </button>
              {(file.url || file.file) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-700 rounded-md font-medium text-gray-300 bg-transparent hover:bg-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </form>
        </div>

        {summary.error && (
          <div className="bg-[#3B1818] border-l-4 border-red-500 p-4 mb-8 rounded-r-md">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div className="ml-3">
                <p className="text-red-400">{summary.error}</p>
              </div>
            </div>
          </div>
        )}

        {summary.text && (
          <div className="bg-[#282828] rounded-lg shadow-xl p-8">
            <div className="flex items-center space-x-2 mb-6">
              <Sparkles className="h-6 w-6 text-red-600" />
              <h2 className="text-2xl font-semibold">AI Summary</h2>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg">{summary.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;