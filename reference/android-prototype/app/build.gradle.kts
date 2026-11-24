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
        versionCode = 16
        versionName = "0.11.1"
        // The native prover is built for 64-bit ARM phones only (reference/native-prover).
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    // The proving key and witness graph are read whole; storing them uncompressed avoids
    // inflating 25 MB at every start.
    androidResources { noCompress += listOf("zkey", "graph", "bin", "gzdata", "wtns", "onnx") }
    buildTypes { release { isMinifyEnabled = false } }
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
