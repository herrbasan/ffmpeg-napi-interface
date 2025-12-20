#include "decoder.h"
#include <cstring>
#include <algorithm>

FFmpegDecoder::FFmpegDecoder() 
    : formatCtx(nullptr)
    , codecCtx(nullptr)
    , swrCtx(nullptr)
    , packet(nullptr)
    , frame(nullptr)
    , audioStreamIndex(-1)
    , sampleBuffer(nullptr)
    , sampleBufferSize(0)
    , samplesInBuffer(0)
    , bufferReadPos(0)
{
    packet = av_packet_alloc();
    frame = av_frame_alloc();
}

FFmpegDecoder::~FFmpegDecoder() {
    close();
    if (packet) av_packet_free(&packet);
    if (frame) av_frame_free(&frame);
}

bool FFmpegDecoder::open(const char* filePath) {
    // Open input file
    if (avformat_open_input(&formatCtx, filePath, nullptr, nullptr) < 0) {
        return false;
    }
    
    // Retrieve stream information
    if (avformat_find_stream_info(formatCtx, nullptr) < 0) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Find audio stream
    audioStreamIndex = -1;
    for (unsigned int i = 0; i < formatCtx->nb_streams; i++) {
        if (formatCtx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIndex = i;
            break;
        }
    }
    
    if (audioStreamIndex == -1) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Get codec parameters
    AVCodecParameters* codecParams = formatCtx->streams[audioStreamIndex]->codecpar;
    
    // Find decoder
    const AVCodec* codec = avcodec_find_decoder(codecParams->codec_id);
    if (!codec) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Allocate codec context
    codecCtx = avcodec_alloc_context3(codec);
    if (!codecCtx) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Copy codec parameters to context
    if (avcodec_parameters_to_context(codecCtx, codecParams) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Open codec
    if (avcodec_open2(codecCtx, codec, nullptr) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Initialize resampler
    if (!initResampler()) {
        close();
        return false;
    }
    
    // Allocate sample buffer (1 second of audio)
    sampleBufferSize = OUTPUT_SAMPLE_RATE * OUTPUT_CHANNELS;
    sampleBuffer = new float[sampleBufferSize];
    
    return true;
}

bool FFmpegDecoder::initResampler() {
    // Determine input channel layout (FFmpeg 7.0+ uses ch_layout instead of channel_layout)
    AVChannelLayout in_ch_layout;
    if (codecCtx->ch_layout.nb_channels > 0) {
        in_ch_layout = codecCtx->ch_layout;
    } else {
        // Fallback to stereo if not specified
        av_channel_layout_default(&in_ch_layout, 2);
    }
    
    // Create output channel layout (stereo)
    AVChannelLayout out_ch_layout = AV_CHANNEL_LAYOUT_STEREO;
    
    // Create resampler context (FFmpeg 7.0+ API)
    int ret = swr_alloc_set_opts2(
        &swrCtx,
        &out_ch_layout,                // Output channel layout
        AV_SAMPLE_FMT_FLT,             // Output sample format (float32)
        OUTPUT_SAMPLE_RATE,            // Output sample rate
        &in_ch_layout,                 // Input channel layout
        codecCtx->sample_fmt,          // Input sample format
        codecCtx->sample_rate,         // Input sample rate
        0, nullptr
    );
    
    if (ret < 0 || !swrCtx) {
        return false;
    }
    
    // Initialize resampler
    if (swr_init(swrCtx) < 0) {
        swr_free(&swrCtx);
        return false;
    }
    
    return true;
}

void FFmpegDecoder::close() {
    delete[] sampleBuffer;
    sampleBuffer = nullptr;
    
    if (swrCtx) {
        swr_free(&swrCtx);
        swrCtx = nullptr;
    }
    
    if (codecCtx) {
        avcodec_free_context(&codecCtx);
        codecCtx = nullptr;
    }
    
    if (formatCtx) {
        avformat_close_input(&formatCtx);
        formatCtx = nullptr;
    }
    
    audioStreamIndex = -1;
    samplesInBuffer = 0;
    bufferReadPos = 0;
}

bool FFmpegDecoder::seek(double seconds) {
    if (!formatCtx) return false;
    
    // Convert seconds to stream time base
    AVStream* stream = formatCtx->streams[audioStreamIndex];
    int64_t timestamp = static_cast<int64_t>(seconds * AV_TIME_BASE);
    
    // Seek to timestamp
    if (av_seek_frame(formatCtx, audioStreamIndex, 
                     av_rescale_q(timestamp, AV_TIME_BASE_Q, stream->time_base),
                     AVSEEK_FLAG_BACKWARD) < 0) {
        return false;
    }
    
    // Flush codec buffers
    avcodec_flush_buffers(codecCtx);
    
    // Clear sample buffer
    samplesInBuffer = 0;
    bufferReadPos = 0;
    
    return true;
}

int FFmpegDecoder::decodeNextFrame() {
    while (true) {
        // Read packet
        int ret = av_read_frame(formatCtx, packet);
        if (ret < 0) {
            if (ret == AVERROR_EOF) {
                return 0; // End of file
            }
            return -1; // Error
        }
        
        // Skip non-audio packets
        if (packet->stream_index != audioStreamIndex) {
            av_packet_unref(packet);
            continue;
        }
        
        // Send packet to decoder
        ret = avcodec_send_packet(codecCtx, packet);
        av_packet_unref(packet);
        
        if (ret < 0) {
            return -1; // Error
        }
        
        // Receive decoded frame
        ret = avcodec_receive_frame(codecCtx, frame);
        if (ret == AVERROR(EAGAIN)) {
            continue; // Need more packets
        }
        if (ret < 0) {
            return -1; // Error
        }
        
        // Resample to output format
        uint8_t* output_buffer = reinterpret_cast<uint8_t*>(sampleBuffer);
        int out_samples = swr_convert(
            swrCtx,
            &output_buffer,
            sampleBufferSize / OUTPUT_CHANNELS,
            const_cast<const uint8_t**>(frame->data),
            frame->nb_samples
        );
        
        av_frame_unref(frame);
        
        if (out_samples < 0) {
            return -1; // Error
        }
        
        samplesInBuffer = out_samples * OUTPUT_CHANNELS;
        bufferReadPos = 0;
        
        return samplesInBuffer;
    }
}

int FFmpegDecoder::read(float* outBuffer, int numSamples) {
    if (!formatCtx || !outBuffer) return 0;
    
    int totalRead = 0;
    
    while (totalRead < numSamples) {
        // If buffer is empty, decode next frame
        if (bufferReadPos >= samplesInBuffer) {
            int decoded = decodeNextFrame();
            if (decoded <= 0) {
                break; // End of file or error
            }
        }
        
        // Copy from internal buffer
        int available = samplesInBuffer - bufferReadPos;
        int toCopy = std::min(available, numSamples - totalRead);
        
        memcpy(outBuffer + totalRead, sampleBuffer + bufferReadPos, toCopy * sizeof(float));
        
        bufferReadPos += toCopy;
        totalRead += toCopy;
    }
    
    return totalRead;
}

double FFmpegDecoder::getDuration() const {
    if (!formatCtx) return 0.0;
    
    if (formatCtx->duration != AV_NOPTS_VALUE) {
        return static_cast<double>(formatCtx->duration) / AV_TIME_BASE;
    }
    
    AVStream* stream = formatCtx->streams[audioStreamIndex];
    if (stream->duration != AV_NOPTS_VALUE) {
        return static_cast<double>(stream->duration) * av_q2d(stream->time_base);
    }
    
    return 0.0;
}

int64_t FFmpegDecoder::getTotalSamples() const {
    return static_cast<int64_t>(getDuration() * OUTPUT_SAMPLE_RATE);
}

bool FFmpegDecoder::hasError() const {
    return false; // TODO: Implement error tracking
}
