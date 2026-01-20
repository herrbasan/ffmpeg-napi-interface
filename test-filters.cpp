#include <iostream>
extern "C" {
#include <libavfilter/avfilter.h>
#include <libavfilter/version.h>
}

int main() {
    std::cout << "FFmpeg libavfilter version: " 
              << LIBAVFILTER_VERSION_MAJOR << "." 
              << LIBAVFILTER_VERSION_MINOR << "." 
              << LIBAVFILTER_VERSION_MICRO << std::endl;
    
    const char* filters[] = {
        "rubberband",
        "atempo",
        "asetrate",
        "aresample",
        "volume",
        "pan"
    };
    
    std::cout << "\nChecking available audio filters:\n";
    std::cout << "==================================\n";
    
    for (const char* name : filters) {
        const AVFilter* filter = avfilter_get_by_name(name);
        if (filter) {
            std::cout << "✓ " << name << " - " << filter->description << std::endl;
        } else {
            std::cout << "✗ " << name << " - NOT AVAILABLE" << std::endl;
        }
    }
    
    return 0;
}
