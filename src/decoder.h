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

    // Decoder/resampler drain state
    bool eofSignaled;
    bool decoderDrained;
    bool resamplerDrained;

    // Metadata helpers
    static std::string getTag(AVDictionary* dict, const char* key);
    static int parseTrackNumber(const std::string& str, int* total);
    
    // Output format (per-instance sample rate, fixed stereo)
    static const int DEFAULT_OUTPUT_SAMPLE_RATE = 44100;
    static const int OUTPUT_CHANNELS = 2;

    int outputSampleRate;
    int threadCount;
    
    bool initResampler();
    int decodeNextFrame();
    void flushBuffers();
    
public:
    FFmpegDecoder();
    ~FFmpegDecoder();
    
    // Lifecycle
    bool open(const char* filePath, int outSampleRate = DEFAULT_OUTPUT_SAMPLE_RATE, int threads = 0);
    void close();
    
    // Playback
    bool seek(double seconds);
    int read(float* outBuffer, int numSamples);
    
    // Metadata
    double getDuration() const;
    int getSampleRate() const { return outputSampleRate; }
    int getChannels() const { return OUTPUT_CHANNELS; }
    int64_t getTotalSamples() const;

    struct AudioMetadata {
        std::string title;
        std::string artist;
        std::string album;
        std::string albumArtist;
        std::string genre;
        std::string date;
        std::string comment;
        int trackNumber = 0;
        int trackTotal = 0;
        int discNumber = 0;
        int discTotal = 0;

        std::string codec;
        std::string codecLongName;
        std::string format;
        std::string formatLongName;
        double duration = 0.0;
        int bitrate = 0;
        int sampleRate = 0;
        int channels = 0;
        int bitsPerSample = 0;

        std::vector<uint8_t> coverArt;
        std::string coverArtMimeType;
    };

    AudioMetadata getMetadata() const;
    static AudioMetadata getFileMetadata(const char* filePath);
    
    // Status
    bool isOpen() const { return formatCtx != nullptr; }
    bool hasError() const;
};

#endif // FFMPEG_DECODER_H
