#ifndef FFMPEG_DECODER_H
#define FFMPEG_DECODER_H

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswresample/swresample.h>
#include <libavutil/opt.h>
}

#include <string>
#include <vector>

/**
 * AudioMetadata - All metadata from an audio file
 */
struct AudioMetadata {
    // Tags
    std::string title;
    std::string artist;
    std::string album;
    std::string albumArtist;
    std::string genre;
    std::string date;
    std::string comment;
    int trackNumber;
    int trackTotal;
    int discNumber;
    int discTotal;
    
    // Format info
    std::string codec;
    std::string codecLongName;
    std::string format;
    std::string formatLongName;
    double duration;          // seconds
    int bitrate;              // bits/sec
    int sampleRate;           // original sample rate
    int channels;             // original channel count
    int bitsPerSample;        // for lossless formats
    
    // Cover art
    std::vector<uint8_t> coverArt;    // JPEG/PNG bytes
    std::string coverArtMimeType;
    
    AudioMetadata() : trackNumber(0), trackTotal(0), discNumber(0), discTotal(0),
                      duration(0), bitrate(0), sampleRate(0), channels(0), bitsPerSample(0) {}
};

/**
 * FFmpegDecoder - High-performance audio decoder using FFmpeg libraries
 * 
 * Features:
 * - Decodes any audio format FFmpeg supports
 * - Instant seeking via av_seek_frame()
 * - Streams samples on-demand for real-time playback
 * - Output: float32 stereo at 44.1kHz (via libswresample)
 */
class FFmpegDecoder {
private:
    AVFormatContext* formatCtx;
    AVCodecContext* codecCtx;
    SwrContext* swrCtx;
    AVPacket* packet;
    AVFrame* frame;
    int audioStreamIndex;
    
    // Decoded sample buffer (interleaved float32 stereo)
    float* sampleBuffer;
    int sampleBufferSize;     // Total capacity in samples
    int samplesInBuffer;      // Current number of samples
    int bufferReadPos;        // Read position in samples
    
    // Output format (fixed)
    static const int OUTPUT_SAMPLE_RATE = 44100;
    static const int OUTPUT_CHANNELS = 2;
    
    bool initResampler();
    int decodeNextFrame();
    void flushBuffers();
    
    // Helper for metadata extraction
    static std::string getTag(AVDictionary* dict, const char* key);
    static int parseTrackNumber(const std::string& str, int* total);
    
public:
    FFmpegDecoder();
    ~FFmpegDecoder();
    
    // Lifecycle
    bool open(const char* filePath);
    void close();
    
    // Playback
    bool seek(double seconds);
    int read(float* outBuffer, int numSamples);
    
    // Metadata
    double getDuration() const;
    int getSampleRate() const { return OUTPUT_SAMPLE_RATE; }
    int getChannels() const { return OUTPUT_CHANNELS; }
    int64_t getTotalSamples() const;
    
    // Full metadata extraction
    AudioMetadata getMetadata() const;
    static AudioMetadata getFileMetadata(const char* filePath);
    
    // Status
    bool isOpen() const { return formatCtx != nullptr; }
    bool hasError() const;
};

#endif // FFMPEG_DECODER_H
