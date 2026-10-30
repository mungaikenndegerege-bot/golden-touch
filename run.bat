@echo off
set PROJ=c:\Users\user\Documents\NetBeansProjects\Golden Touch
set DIST=%PROJ%\dist
set LIB=%PROJ%\lib

if not exist "%DIST%\GoldenTouch.jar" (
    echo GoldenTouch.jar not found. Please run build.bat first.
    pause
    exit /b 1
)

echo Starting Golden Touch Shop...
echo Open your browser at: http://localhost:7071
echo Press Ctrl+C to stop the server.
echo.
java -cp "%DIST%\GoldenTouch.jar;%LIB%\*" golden.touch.ShopApiServer
pause
