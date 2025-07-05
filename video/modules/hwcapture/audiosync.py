import numpy as np
import librosa
import scipy.signal
from moviepy.editor import VideoFileClip
import matplotlib.pyplot as plt

class VideoSyncer:
    def __init__(self, video1_path, video2_path):
        self.video1_path = video1_path
        self.video2_path = video2_path
        self.audio1 = None
        self.audio2 = None
        self.sr = None
        
    def extract_audio(self):
        """Extract audio from both videos"""
        print("Extracting audio from videos...")
        
        # Load videos and extract audio
        video1 = VideoFileClip(self.video1_path)
        video2 = VideoFileClip(self.video2_path)
        
        # Get audio as numpy arrays
        audio1_array = video1.audio.to_soundarray()
        audio2_array = video2.audio.to_soundarray()
        
        # Convert to mono if stereo
        if len(audio1_array.shape) > 1:
            audio1_array = np.mean(audio1_array, axis=1)
        if len(audio2_array.shape) > 1:
            audio2_array = np.mean(audio2_array, axis=1)
        
        # Resample to consistent sample rate
        self.sr = 22050  # Standard sample rate for analysis
        self.audio1 = librosa.resample(audio1_array, orig_sr=video1.audio.fps, target_sr=self.sr)
        self.audio2 = librosa.resample(audio2_array, orig_sr=video2.audio.fps, target_sr=self.sr)
        
        video1.close()
        video2.close()
        
        print(f"Audio 1 length: {len(self.audio1)/self.sr:.2f} seconds")
        print(f"Audio 2 length: {len(self.audio2)/self.sr:.2f} seconds")
    
    def find_offset_correlation(self):
        """Find offset using cross-correlation"""
        print("Computing cross-correlation...")
        
        # Normalize audio
        audio1_norm = self.audio1 / np.max(np.abs(self.audio1))
        audio2_norm = self.audio2 / np.max(np.abs(self.audio2))
        
        # Compute cross-correlation
        correlation = scipy.signal.correlate(audio2_norm, audio1_norm, mode='full')
        
        # Find the lag with maximum correlation
        lags = scipy.signal.correlation_lags(len(audio2_norm), len(audio1_norm), mode='full')
        max_corr_index = np.argmax(correlation)
        offset_samples = lags[max_corr_index]
        
        # Convert to seconds
        offset_seconds = offset_samples / self.sr
        
        print(f"Offset found: {offset_seconds:.3f} seconds")
        print(f"Correlation strength: {correlation[max_corr_index]:.3f}")
        
        return offset_seconds, correlation[max_corr_index]
    
    def find_offset_mfcc(self):
        """Find offset using MFCC features (more robust)"""
        print("Computing MFCC-based sync...")
        
        # Extract MFCC features
        mfcc1 = librosa.feature.mfcc(y=self.audio1, sr=self.sr, n_mfcc=13)
        mfcc2 = librosa.feature.mfcc(y=self.audio2, sr=self.sr, n_mfcc=13)
        
        # Use first MFCC coefficient for sync (represents spectral shape)
        mfcc1_sync = mfcc1[0, :]
        mfcc2_sync = mfcc2[0, :]
        
        # Cross-correlate MFCC features
        correlation = scipy.signal.correlate(mfcc2_sync, mfcc1_sync, mode='full')
        lags = scipy.signal.correlation_lags(len(mfcc2_sync), len(mfcc1_sync), mode='full')
        
        max_corr_index = np.argmax(correlation)
        offset_frames = lags[max_corr_index]
        
        # Convert to seconds (MFCC hop length is 512 samples by default)
        hop_length = 512
        offset_seconds = (offset_frames * hop_length) / self.sr
        
        print(f"MFCC offset found: {offset_seconds:.3f} seconds")
        print(f"MFCC correlation strength: {correlation[max_corr_index]:.3f}")
        
        return offset_seconds, correlation[max_corr_index]
    
    def plot_waveforms(self, offset_seconds=0):
        """Plot waveforms for visual inspection"""
        plt.figure(figsize=(12, 8))
        
        # Time arrays
        time1 = np.arange(len(self.audio1)) / self.sr
        time2 = np.arange(len(self.audio2)) / self.sr + offset_seconds
        
        plt.subplot(2, 1, 1)
        plt.plot(time1, self.audio1, alpha=0.7, label='Video 1')
        plt.plot(time2, self.audio2, alpha=0.7, label='Video 2 (offset)')
        plt.xlabel('Time (seconds)')
        plt.ylabel('Amplitude')
        plt.title('Audio Waveforms')
        plt.legend()
        plt.grid(True)
        
        # Zoom in on first 30 seconds
        plt.subplot(2, 1, 2)
        mask1 = time1 <= 30
        mask2 = time2 <= 30
        plt.plot(time1[mask1], self.audio1[mask1], alpha=0.7, label='Video 1')
        plt.plot(time2[mask2], self.audio2[mask2], alpha=0.7, label='Video 2 (offset)')
        plt.xlabel('Time (seconds)')
        plt.ylabel('Amplitude')
        plt.title('Audio Waveforms (First 30 seconds)')
        plt.legend()
        plt.grid(True)
        
        plt.tight_layout()
        plt.show()
    
    def sync_videos(self, output1_path, output2_path, offset_seconds):
        """Apply the sync offset and save videos"""
        print(f"Applying sync offset of {offset_seconds:.3f} seconds...")
        
        video1 = VideoFileClip(self.video1_path)
        video2 = VideoFileClip(self.video2_path)
        
        if offset_seconds > 0:
            # Video 2 starts later, so delay video 1
            video1_synced = video1.subclip(offset_seconds)
            video2_synced = video2
        else:
            # Video 1 starts later, so delay video 2
            video1_synced = video1
            video2_synced = video2.subclip(-offset_seconds)
        
        # Make sure both videos have the same duration
        min_duration = min(video1_synced.duration, video2_synced.duration)
        video1_synced = video1_synced.subclip(0, min_duration)
        video2_synced = video2_synced.subclip(0, min_duration)
        
        # Save synced videos
        print("Saving synced videos...")
        video1_synced.write_videofile(output1_path, codec='libx264', audio_codec='aac')
        video2_synced.write_videofile(output2_path, codec='libx264', audio_codec='aac')
        
        video1.close()
        video2.close()
        video1_synced.close()
        video2_synced.close()
        
        print("Sync complete!")

"""
def main():
    # Example usage
    video1_path = "camera_footage.mp4"  # Your full frame camera footage
    video2_path = "360_footage.mp4"     # Your equirectangular footage
    
    # Initialize syncer
    syncer = VideoSyncer(video1_path, video2_path)
    
    # Extract audio
    syncer.extract_audio()
    
    # Find sync offset using both methods
    offset_corr, corr_strength = syncer.find_offset_correlation()
    offset_mfcc, mfcc_strength = syncer.find_offset_mfcc()
    
    # Choose the method with higher correlation strength
    if corr_strength > mfcc_strength:
        print(f"Using correlation method: {offset_corr:.3f}s")
        offset = offset_corr
    else:
        print(f"Using MFCC method: {offset_mfcc:.3f}s")
        offset = offset_mfcc
    
    # Plot waveforms for visual verification
    syncer.plot_waveforms(offset)
    
    # Apply sync and save
    syncer.sync_videos("synced_camera.mp4", "synced_360.mp4", offset)

if __name__ == "__main__":
     main()
""" 