#include <napi.h>
#include "decoder.h"
#include <memory>

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
    
    bool success = decoder->open(filePath.c_str());
    
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
