@echo off
echo ============================================
echo   Golden Touch — Build Script
echo ============================================

set PROJ=c:\Users\user\Documents\NetBeansProjects\Golden Touch
set LIB=%PROJ%\lib
set SRC=%PROJ%\src
set BUILD=%PROJ%\build\classes
set DIST=%PROJ%\dist
set WEB=%PROJ%\web

:: Build classpath
set CP=%LIB%\jackson-annotations-2.13.4.jar;%LIB%\jackson-core-2.13.4.jar;%LIB%\jackson-databind-2.13.4.jar;%LIB%\javalin-4.6.8.jar;%LIB%\javax.servlet-api.jar;%LIB%\jetty-http.jar;%LIB%\jetty-io.jar;%LIB%\jetty-security.jar;%LIB%\jetty-server.jar;%LIB%\jetty-servlet.jar;%LIB%\jetty-util.jar;%LIB%\jetty-webapp.jar;%LIB%\jetty-xml.jar;%LIB%\kotlin-stdlib-1.7.10.jar;%LIB%\slf4j-api-1.7.36.jar;%LIB%\slf4j-simple-1.7.36.jar;%LIB%\websocket-api.jar;%LIB%\websocket-common.jar;%LIB%\websocket-server.jar;%LIB%\websocket-servlet.jar

if not exist "%BUILD%" mkdir "%BUILD%"
if not exist "%DIST%"  mkdir "%DIST%"

echo Compiling Java sources...
javac -source 1.8 -target 1.8 -cp "%CP%" -d "%BUILD%" "%SRC%\golden\touch\ShopData.java" "%SRC%\golden\touch\ShopApiServer.java"
if errorlevel 1 (
    echo COMPILE FAILED!
    pause
    exit /b 1
)
echo Compile OK.

echo Copying web assets...
xcopy /E /Y /Q "%WEB%\*" "%BUILD%\web\"

echo Building JAR...
jar cfe "%DIST%\GoldenTouch.jar" golden.touch.ShopApiServer -C "%BUILD%" .
if errorlevel 1 (
    echo JAR BUILD FAILED!
    pause
    exit /b 1
)

echo.
echo ============================================
echo   BUILD COMPLETE!
echo   Run the app:
echo   java -cp "%DIST%\GoldenTouch.jar;%LIB%\*" golden.touch.ShopApiServer
echo   Then open: http://localhost:7071
echo ============================================
pause
