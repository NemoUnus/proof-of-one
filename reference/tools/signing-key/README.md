# The app's signing key

Android installs a new version of an app over an old one only if both are signed with the same key. From app v0.16 the pilot app is signed with one fixed key (Decision #67, point 6), made once with this page and kept only in the repository's secrets.

**Page:** `https://nemounus.github.io/proof-of-one/reference/tools/signing-key/`

- The key (RSA-3072) is made by the browser's own crypto engine (Web Crypto) and packed as a PKCS#12 file by [node-forge](https://github.com/digitalbazaar/forge) 1.3.1, vendored here (`forge.min.js`, BSD licence in `LICENSE-forge.txt`; SHA-256 `dc67fd132427ad96c9666c844b39565413c40ddb1f2d063c53512fbf6d387dfd`, as published on npm).
- The page's Content-Security-Policy forbids any network connection, so nothing it makes can be sent anywhere. It stores nothing.
- It shows two values, copied by the maintainer into **Settings → Secrets and variables → Actions** as `POO_KEYSTORE_B64` and `POO_KEYSTORE_PASSWORD`, and offers the key file for an offline copy.
- The workflow `.github/workflows/android-prototype.yml` writes the key to a temporary file, builds the release APK with it, deletes the file, and prints the APK's signing certificate beside its SHA-256, so anyone can check that each published APK carries the same certificate.

If the key were lost, every member would have to remove the app and restore their membership once more (with the passport and the password). If it were stolen, someone could make an app that installs over the pilot app; a new key would then be made, and members told to reinstall.
