@echo off
echo Syncing web assets...
node sync.js

echo Updating Capacitor Android project...
call npx cap sync android

echo Building Android App Bundle (Release)...
cd android
call gradlew.bat bundleRelease

echo Build complete!
echo The AAB should be located at: android\app\build\outputs\bundle\release\app-release.aab
cd ..
