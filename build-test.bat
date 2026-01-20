@echo off
setlocal

set FFMPEG_DEPS=%~dp0deps
set INCLUDE_PATHS=-I"%FFMPEG_DEPS%\ffmpeg\include"
set LIB_PATHS=-L"%FFMPEG_DEPS%\win\lib"
set LIBS=-lavfilter -lavutil

echo Compiling filter test...
g++ -std=c++17 %INCLUDE_PATHS% test-filters.cpp %LIB_PATHS% %LIBS% -o test-filters.exe

if %errorlevel% equ 0 (
    echo.
    echo Compilation successful. Running test...
    echo.
    set PATH=%FFMPEG_DEPS%\win\bin;%PATH%
    test-filters.exe
) else (
    echo.
    echo Compilation failed. Trying with cl (MSVC)...
    echo.
    cl /EHsc /std:c++17 /I"%FFMPEG_DEPS%\ffmpeg\include" test-filters.cpp /link /LIBPATH:"%FFMPEG_DEPS%\win\lib" avfilter.lib avutil.lib
    if %errorlevel% equ 0 (
        echo.
        echo Running test...
        echo.
        set PATH=%FFMPEG_DEPS%\win\bin;%PATH%
        test-filters.exe
    ) else (
        echo.
        echo Both compilers failed. Make sure you have either:
        echo   - MinGW-w64 (g++) in PATH
        echo   - Visual Studio (cl) in PATH
    )
)

endlocal
