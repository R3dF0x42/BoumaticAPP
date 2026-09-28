@echo off
setlocal
set "JAVA_EXE=java.exe"
if defined JAVA_HOME set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
"%JAVA_EXE%" -version >nul 2>&1
if errorlevel 1 (
    echo Java introuvable. Configurer JAVA_HOME avec le JDK 17 ou 21 d'Android Studio. 1>&2
    exit /b 1
)
"%JAVA_EXE%" -classpath "%~dp0gradle\wrapper\gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain %*
exit /b %ERRORLEVEL%
