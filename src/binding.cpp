#include <napi.h>
#include "decoder.h"
#include <memory>
#include <algorithm>
#include <vector>

static Napi::Object MetadataToJS(Napi::Env env, const FFmpegDecoder::AudioMetadata& meta) {
    Napi::Object obj = Napi::Object::New(env);

    obj.Set("title", Napi::String::New(env, meta.title));
    obj.Set("artist", Napi::String::New(env, meta.artist));
    obj.Set("album", Napi::String::New(env, meta.album));
    obj.Set("albumArtist", Napi::String::New(env, meta.albumArtist));
    obj.Set("genre", Napi::String::New(env, meta.genre));
    obj.Set("date", Napi::String::New(env, meta.date));
    obj.Set("comment", Napi::String::New(env, meta.comment));
    obj.Set("trackNumber", Napi::Number::New(env, meta.trackNumber));
    obj.Set("trackTotal", Napi::Number::New(env, meta.trackTotal));
    obj.Set("discNumber", Napi::Number::New(env, meta.discNumber));
    obj.Set("discTotal", Napi::Number::New(env, meta.discTotal));

    obj.Set("codec", Napi::String::New(env, meta.codec));
    obj.Set("codecLongName", Napi::String::New(env, meta.codecLongName));
    obj.Set("format", Napi::String::New(env, meta.format));
    obj.Set("formatLongName", Napi::String::New(env, meta.formatLongName));
    obj.Set("duration", Napi::Number::New(env, meta.duration));
    obj.Set("bitrate", Napi::Number::New(env, meta.bitrate));
    obj.Set("sampleRate", Napi::Number::New(env, meta.sampleRate));
    obj.Set("channels", Napi::Number::New(env, meta.channels));
    obj.Set("bitsPerSample", Napi::Number::New(env, meta.bitsPerSample));

    if (!meta.coverArt.empty()) {
        Napi::Buffer<uint8_t> coverBuf = Napi::Buffer<uint8_t>::Copy(env, meta.coverArt.data(), meta.coverArt.size());
        obj.Set("coverArt", coverBuf);
        obj.Set("coverArtMimeType", Napi::String::New(env, meta.coverArtMimeType));
    } else {
        obj.Set("coverArt", env.Null());
        obj.Set("coverArtMimeType", Napi::String::New(env, ""));
    }

    return obj;
}

/**
 * NAPI Wrapper for FFmpegDecoder
 * Provides JavaScript interface to the native FFmpeg decoder
 */
class DecoderWrapper : public Napi::ObjectWrap<DecoderWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    DecoderWrapper(const Napi::CallbackInfo& info);
    ~DecoderWrapper();

private:
    std::unique_ptr<FFmpegDecoder> decoder;
    
    // Methods
    Napi::Value Open(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value Read(const Napi::CallbackInfo& info);
    Napi::Value GetMetadata(const Napi::CallbackInfo& info);
    Napi::Value SetPitchShift(const Napi::CallbackInfo& info);
    Napi::Value SetTimeStretch(const Napi::CallbackInfo& info);
    Napi::Value GetPitchShift(const Napi::CallbackInfo& info);
    Napi::Value GetTimeStretch(const Napi::CallbackInfo& info);
    Napi::Value GetWaveform(const Napi::CallbackInfo& info);
    Napi::Value GetWaveformStreaming(const Napi::CallbackInfo& info);
    
    // Properties
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetSampleRate(const Napi::CallbackInfo& info);
    Napi::Value GetChannels(const Napi::CallbackInfo& info);
    Napi::Value GetTotalSamples(const Napi::CallbackInfo& info);
    Napi::Value IsOpen(const Napi::CallbackInfo& info);
    static Napi::Value GetFileMetadata(const Napi::CallbackInfo& info);
};

DecoderWrapper::DecoderWrapper(const Napi::CallbackInfo& info) 
    : Napi::ObjectWrap<DecoderWrapper>(info) {
    decoder = std::make_unique<FFmpegDecoder>();
}

DecoderWrapper::~DecoderWrapper() {
    // Decoder will auto-close in destructor
}

Napi::Object DecoderWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "FFmpegDecoder", {
        InstanceMethod("open", &DecoderWrapper::Open),
        InstanceMethod("close", &DecoderWrapper::Close),
        InstanceMethod("seek", &DecoderWrapper::Seek),
        InstanceMethod("read", &DecoderWrapper::Read),
        InstanceMethod("getMetadata", &DecoderWrapper::GetMetadata),
        InstanceMethod("setPitchShift", &DecoderWrapper::SetPitchShift),
        InstanceMethod("setTimeStretch", &DecoderWrapper::SetTimeStretch),
        InstanceMethod("getPitchShift", &DecoderWrapper::GetPitchShift),
        InstanceMethod("getTimeStretch", &DecoderWrapper::GetTimeStretch),
        InstanceMethod("getWaveform", &DecoderWrapper::GetWaveform),
        InstanceMethod("getWaveformStreaming", &DecoderWrapper::GetWaveformStreaming),
        InstanceMethod("getDuration", &DecoderWrapper::GetDuration),
        InstanceMethod("getSampleRate", &DecoderWrapper::GetSampleRate),
        InstanceMethod("getChannels", &DecoderWrapper::GetChannels),
        InstanceMethod("getTotalSamples", &DecoderWrapper::GetTotalSamples),
        InstanceMethod("isOpen", &DecoderWrapper::IsOpen),
        StaticMethod("getFileMetadata", &DecoderWrapper::GetFileMetadata)
    });
    
    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);
    
    exports.Set("FFmpegDecoder", func);
    return exports;
}

Napi::Value DecoderWrapper::Open(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string filePath").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string filePath = info[0].As<Napi::String>().Utf8Value();

    int outSampleRate = 0;
    if (info.Length() >= 2 && !info[1].IsUndefined() && !info[1].IsNull()) {
        if (!info[1].IsNumber()) {
            Napi::TypeError::New(env, "Expected number outputSampleRate").ThrowAsJavaScriptException();
            return env.Null();
        }
        outSampleRate = info[1].As<Napi::Number>().Int32Value();
        if (outSampleRate <= 0) {
            Napi::RangeError::New(env, "outputSampleRate must be > 0").ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    int threads = 0;
    if (info.Length() >= 3 && !info[2].IsUndefined() && !info[2].IsNull()) {
        if (!info[2].IsNumber()) {
            Napi::TypeError::New(env, "Expected number threads").ThrowAsJavaScriptException();
            return env.Null();
        }
        threads = info[2].As<Napi::Number>().Int32Value();
        if (threads < 0) {
            Napi::RangeError::New(env, "threads must be >= 0").ThrowAsJavaScriptException();
            return env.Null();
        }
    }

    bool success = decoder->open(filePath.c_str(), outSampleRate, threads);
    
    return Napi::Boolean::New(env, success);
}

void DecoderWrapper::Close(const Napi::CallbackInfo& info) {
    decoder->close();
}

Napi::Value DecoderWrapper::Seek(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected number seconds").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    double seconds = info[0].As<Napi::Number>().DoubleValue();
    bool success = decoder->seek(seconds);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value DecoderWrapper::Read(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected number numSamples").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int numSamples = info[0].As<Napi::Number>().Int32Value();
    
    // Create Float32Array for output
    Napi::Float32Array buffer = Napi::Float32Array::New(env, numSamples);
    
    // Read samples
    int samplesRead = decoder->read(buffer.Data(), numSamples);
    
    // Return object with buffer and actual count
    Napi::Object result = Napi::Object::New(env);
    result.Set("buffer", buffer);
    result.Set("samplesRead", Napi::Number::New(env, samplesRead));
    
    return result;
}

Napi::Value DecoderWrapper::GetDuration(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, decoder->getDuration());
}

Napi::Value DecoderWrapper::GetSampleRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, decoder->getSampleRate());
}

Napi::Value DecoderWrapper::GetChannels(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, decoder->getChannels());
}

Napi::Value DecoderWrapper::GetTotalSamples(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, static_cast<double>(decoder->getTotalSamples()));
}

Napi::Value DecoderWrapper::IsOpen(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, decoder->isOpen());
}

Napi::Value DecoderWrapper::GetMetadata(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!decoder->isOpen()) {
        Napi::Error::New(env, "Decoder is not open").ThrowAsJavaScriptException();
        return env.Null();
    }

    FFmpegDecoder::AudioMetadata meta = decoder->getMetadata();
    return MetadataToJS(env, meta);
}

Napi::Value DecoderWrapper::GetFileMetadata(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string filePath").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    FFmpegDecoder::AudioMetadata meta = FFmpegDecoder::getFileMetadata(filePath.c_str());
    return MetadataToJS(env, meta);
}

Napi::Value DecoderWrapper::SetPitchShift(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected number semitones").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    double semitones = info[0].As<Napi::Number>().DoubleValue();
    bool success = decoder->setPitchShift(semitones);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value DecoderWrapper::SetTimeStretch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected number rate").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    double rate = info[0].As<Napi::Number>().DoubleValue();
    bool success = decoder->setTimeStretch(rate);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value DecoderWrapper::GetPitchShift(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, decoder->getPitchShift());
}

Napi::Value DecoderWrapper::GetTimeStretch(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Number::New(env, decoder->getTimeStretch());
}

Napi::Value DecoderWrapper::GetWaveform(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected number numPoints").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int numPoints = info[0].As<Napi::Number>().Int32Value();
    FFmpegDecoder::WaveformData data = decoder->getWaveform(numPoints);
    
    Napi::Object result = Napi::Object::New(env);
    
    Napi::Float32Array peaksL = Napi::Float32Array::New(env, data.peaksL.size());
    std::copy(data.peaksL.begin(), data.peaksL.end(), peaksL.Data());
    
    Napi::Float32Array peaksR = Napi::Float32Array::New(env, data.peaksR.size());
    std::copy(data.peaksR.begin(), data.peaksR.end(), peaksR.Data());
    
    result.Set("peaksL", peaksL);
    result.Set("peaksR", peaksR);
    result.Set("points", Napi::Number::New(env, data.points));
    
    return result;
}

Napi::Value DecoderWrapper::GetWaveformStreaming(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3 || !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsFunction()) {
        Napi::TypeError::New(env, "Expected (numPoints: number, chunkSizeMB: number, callback: function)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    int numPoints = info[0].As<Napi::Number>().Int32Value();
    int chunkSizeMB = info[1].As<Napi::Number>().Int32Value();
    Napi::Function jsCallback = info[2].As<Napi::Function>();
    
    int64_t chunkSizeBytes = (int64_t)chunkSizeMB * 1024 * 1024;
    
    // Create C++ callback that invokes JS callback
    auto callback = [&](const FFmpegDecoder::WaveformData& data, float progress) -> bool {
        Napi::Object result = Napi::Object::New(env);
        
        Napi::Float32Array peaksL = Napi::Float32Array::New(env, data.peaksL.size());
        std::copy(data.peaksL.begin(), data.peaksL.end(), peaksL.Data());
        
        Napi::Float32Array peaksR = Napi::Float32Array::New(env, data.peaksR.size());
        std::copy(data.peaksR.begin(), data.peaksR.end(), peaksR.Data());
        
        result.Set("peaksL", peaksL);
        result.Set("peaksR", peaksR);
        result.Set("points", Napi::Number::New(env, data.points));
        result.Set("progress", Napi::Number::New(env, progress));
        
        Napi::Value jsResult = jsCallback.Call({ result });
        
        // Return false to abort if callback returns false
        if (jsResult.IsBoolean()) {
            return jsResult.As<Napi::Boolean>().Value();
        }
        return true; // Continue by default
    };
    
    FFmpegDecoder::WaveformData finalData = decoder->getWaveformStreaming(numPoints, chunkSizeBytes, callback);
    
    Napi::Object result = Napi::Object::New(env);
    
    Napi::Float32Array peaksL = Napi::Float32Array::New(env, finalData.peaksL.size());
    std::copy(finalData.peaksL.begin(), finalData.peaksL.end(), peaksL.Data());
    
    Napi::Float32Array peaksR = Napi::Float32Array::New(env, finalData.peaksR.size());
    std::copy(finalData.peaksR.begin(), finalData.peaksR.end(), peaksR.Data());
    
    result.Set("peaksL", peaksL);
    result.Set("peaksR", peaksR);
    result.Set("points", Napi::Number::New(env, finalData.points));
    
    return result;
}

static Napi::Value GetMetadata(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected string filePath").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    FFmpegDecoder::AudioMetadata meta = FFmpegDecoder::getFileMetadata(filePath.c_str());
    return MetadataToJS(env, meta);
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    DecoderWrapper::Init(env, exports);
    exports.Set("getMetadata", Napi::Function::New(env, GetMetadata));
    return exports;
}

NODE_API_MODULE(ffmpeg_napi, Init)
