import React, { useState, useRef, useEffect } from 'react';
import './MediaViewer.css';

interface MediaViewerProps {
  filePath: string;
  fileName: string;
}

type MediaType = 'image' | 'video' | 'audio' | 'unknown';

// Supported file extensions
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];

export const getMediaType = (filePath: string): MediaType => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  
  return 'unknown';
};

export const isMediaFile = (filePath: string): boolean => {
  return getMediaType(filePath) !== 'unknown';
};

const MediaViewer: React.FC<MediaViewerProps> = ({ filePath, fileName }) => {
  const mediaType = getMediaType(filePath);
  const [zoom, setZoom] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Convert file path to file:// URL for Electron
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;

  // Handle image load to get dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Zoom controls for images
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 500));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleZoomReset = () => setZoom(100);

  // Media player controls
  const togglePlayPause = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      if (isPlaying) {
        media.pause();
      } else {
        media.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media = videoRef.current || audioRef.current;
    if (media) {
      setDuration(media.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const media = videoRef.current || audioRef.current;
    const time = parseFloat(e.target.value);
    if (media) {
      media.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    const media = videoRef.current || audioRef.current;
    if (media) {
      media.volume = vol;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Reset state when file changes
  useEffect(() => {
    setZoom(100);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setImageSize(null);
  }, [filePath]);

  return (
    <div className="media-viewer">
      <div className="media-viewer-header">
        <span className="media-viewer-filename">{fileName}</span>
        {mediaType === 'image' && imageSize && (
          <span className="media-viewer-info">
            {imageSize.width} × {imageSize.height}px
          </span>
        )}
        {mediaType === 'image' && (
          <div className="media-viewer-controls">
            <button onClick={handleZoomOut} title="Zoom Out">−</button>
            <span className="zoom-level">{zoom}%</span>
            <button onClick={handleZoomIn} title="Zoom In">+</button>
            <button onClick={handleZoomReset} title="Reset Zoom">⟲</button>
          </div>
        )}
      </div>

      <div className="media-viewer-content">
        {mediaType === 'image' && (
          <div className="image-container" style={{ overflow: 'auto' }}>
            <img
              src={fileUrl}
              alt={fileName}
              onLoad={handleImageLoad}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center',
                maxWidth: zoom <= 100 ? '100%' : 'none',
                maxHeight: zoom <= 100 ? '100%' : 'none',
              }}
              draggable={false}
            />
          </div>
        )}

        {mediaType === 'video' && (
          <div className="video-container">
            <video
              ref={videoRef}
              src={fileUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlayPause}
            />
            <div className="media-controls">
              <button className="play-pause-btn" onClick={togglePlayPause}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <input
                type="range"
                className="seek-bar"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
              />
              <div className="volume-control">
                <span className="volume-icon">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
                <input
                  type="range"
                  className="volume-bar"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
        )}

        {mediaType === 'audio' && (
          <div className="audio-container">
            <div className="audio-visualization">
              <div className="audio-icon">🎵</div>
              <div className="audio-filename">{fileName}</div>
            </div>
            <audio
              ref={audioRef}
              src={fileUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="media-controls">
              <button className="play-pause-btn" onClick={togglePlayPause}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <span className="time-display">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <input
                type="range"
                className="seek-bar"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
              />
              <div className="volume-control">
                <span className="volume-icon">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
                <input
                  type="range"
                  className="volume-bar"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
        )}

        {mediaType === 'unknown' && (
          <div className="media-unsupported">
            <p>Unable to preview this file type</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewer;

