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
        versionCode = 2
        versionName = "0.1.1"
    }
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
}
