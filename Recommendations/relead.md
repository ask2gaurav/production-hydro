For production releases (when you're ready to publish), you'll need to sign the APK with a keystore. That's a one-time setup:

# Generate a keystore (do this once, keep it safe)
keytool -genkey -v -keystore dasatva.keystore -alias dasatva -keyalg RSA -keysize 2048 -validity 10000

# Sign + align the release APK
zipalign -v 4 app/build/outputs/apk/release/app-release-unsigned.apk app-release-aligned.apk
apksigner sign --ks dasatva.keystore --out app-release-signed.apk app-release-aligned.apk
