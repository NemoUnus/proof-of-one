// SPDX-License-Identifier: Apache-2.0
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.nemounus.proofofone.reader"
    compileSdk = 35
    defaultConfig {
        applicationId = "io.github.nemounus.proofofone.reader"
        minSdk = 26
        targetSdk = 35
        versionCode = 23
        versionName = "0.17.1"
        // The native prover is built for 64-bit ARM phones only (reference/native-prover).
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    // The proving key and witness graph are read whole; storing them uncompressed avoids
    // inflating 25 MB at every start.
    androidResources { noCompress += listOf("zkey", "graph", "bin", "gzdata", "wtns", "onnx") }
    // One fixed signing key from v0.16 (Decision #67, point 6), so that a new version installs
    // over the old one and members keep their data. The key lives only in the repository's
    // secrets (made with reference/tools/signing-key/). From v0.17 the workflow builds the
    // release unsigned and signs it with apksigner in a separate job; POO_KEYSTORE remains for
    // a local build with the key. Without it, a local release build is signed with the debug key
    // and cannot replace an installed pilot app.
    val pooKeystore = System.getenv("POO_KEYSTORE")
    signingConfigs {
        if (pooKeystore != null) create("pilot") {
            storeFile = file(pooKeystore)
            storeType = "pkcs12"
            storePassword = System.getenv("POO_KEYSTORE_PASSWORD")
            keyAlias = "pilot"
            keyPassword = System.getenv("POO_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // not debuggable: another app or a USB connection cannot read the members' files
            // On the build server (CI) the release is built unsigned, and signed in a separate,
            // protected job of the workflow that never runs the build (second review, N2). It is
            // never signed with the debug key there: such an APK would not install over the pilot
            // app, and uninstalling to "fix" that deletes every member on the phone (review F11).
            signingConfig = when {
                pooKeystore != null -> signingConfigs.getByName("pilot")
                System.getenv("CI") == "true" -> null
                else -> signingConfigs.getByName("debug")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging {
        resources {
            excludes += setOf(
                "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
                "META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*",
            )
        }
    }
}

dependencies {
    // JMRTD (LGPL-2.1+): ICAO 9303 chip access (BAC, PACE) and data-group parsing.
    implementation("org.jmrtd:jmrtd:0.8.0")
    implementation("net.sf.scuba:scuba-smartcards:0.0.20")
    // Bouncy Castle (MIT): CMS signature check of the security object.
    implementation("org.bouncycastle:bcprov-jdk18on:1.80")
    implementation("org.bouncycastle:bcpkix-jdk18on:1.80")
    // Face check test (v0.4): ONNX Runtime (MIT) runs the face models; JP2ForAndroid
    // (BSD-2-Clause, OpenJPEG) decodes JPEG 2000 chip photos; AndroidX core and exifinterface
    // (Apache-2.0) for the selfie file and its orientation.
    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.19.2")
    implementation("io.github.michaldvorak-gemalto:jp2-android:1.0.5")
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.exifinterface:exifinterface:1.3.7")
}
