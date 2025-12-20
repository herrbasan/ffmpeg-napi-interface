#include <napi.h>
#include "decoder.h"
#include <memory>

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
    
    // Properties
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetSampleRate(const Napi::CallbackInfo& info);
    Napi::Value GetChannels(const Napi::CallbackInfo& info);
    Napi::Value GetTotalSamples(const Napi::CallbackInfo& info);
    Napi::Value IsOpen(const Napi::CallbackInfo& info);
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
        InstanceMethod("getDuration", &DecoderWrapper::GetDuration),
        InstanceMethod("getSampleRate", &DecoderWrapper::GetSampleRate),
        InstanceMethod("getChannels", &DecoderWrapper::GetChannels),
        InstanceMethod("getTotalSamples", &DecoderWrapper::GetTotalSamples),
        InstanceMethod("isOpen", &DecoderWrapper::IsOpen)
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

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return DecoderWrapper::Init(env, exports);
}

NODE_API_MODULE(ffmpeg_napi, Init)
