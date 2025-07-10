import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

group = "it.pagopa.ecommerce.eventdispatcher.integrationtests"

version = "0.0.1"

description = "pagoPA eCommerce event dispatcher integration tests repo"

plugins {
    id("java")
    id("org.springframework.boot") version "3.4.5"
    id("io.spring.dependency-management") version "1.1.0"
    kotlin("plugin.spring") version "2.2.0"
    kotlin("jvm") version "2.2.0"
    jacoco
    application
}

// eCommerce commons library version
val ecommerceCommonsVersion = "3.0.0"

// eCommerce commons library git ref (by default tag)
val ecommerceCommonsGitRef = ecommerceCommonsVersion

java { toolchain { languageVersion.set(JavaLanguageVersion.of(21)) } }

repositories {
    mavenCentral()
    mavenLocal()
}

dependencyManagement {
    imports { mavenBom("org.springframework.boot:spring-boot-dependencies:3.4.5") }
    // Kotlin BOM
    imports { mavenBom("org.jetbrains.kotlin:kotlin-bom:2.2.0") }
    imports { mavenBom("org.jetbrains.kotlinx:kotlinx-coroutines-bom:1.7.3") }
}


dependencies {
    // cosmosDB
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb-reactive")
    implementation("com.azure.spring:spring-cloud-azure-starter")
    implementation("com.azure.spring:spring-cloud-azure-starter-data-cosmos")
    // azure storage queue
    implementation("com.azure.spring:spring-cloud-azure-starter")
    implementation("com.azure:azure-storage-queue")
    implementation("com.azure:azure-core-serializer-json-jackson")
    implementation("com.azure:azure-identity")
    implementation("it.pagopa:pagopa-ecommerce-commons:$ecommerceCommonsVersion")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // Kotlin dependencies
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    testImplementation("it.pagopa:pagopa-ecommerce-commons:$ecommerceCommonsVersion:tests")
}

configurations {
    implementation.configure {
        exclude(module = "spring-boot-starter-web")
        exclude("org.apache.tomcat")
        exclude(group = "org.slf4j", module = "slf4j-simple")
    }
}
// Dependency locking - lock all dependencies
dependencyLocking { lockAllConfigurations() }

sourceSets {
    main {
        kotlin {
            srcDirs(
                "src/main/kotlin",
            )
        }
        resources { srcDirs("src/resources") }
    }
}


tasks.withType(JavaCompile::class.java).configureEach { options.encoding = "UTF-8" }

tasks.withType(Javadoc::class.java).configureEach { options.encoding = "UTF-8" }


tasks.register<Exec>("install-commons") {
    commandLine("sh", "./pagopa-ecommerce-commons-maven-install.sh", ecommerceCommonsGitRef)
}

tasks.withType<KotlinCompile> {
    dependsOn("install-commons")
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21) }
}

kotlin { jvmToolchain(21) }

tasks.named<Jar>("jar") { enabled = false }

tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport) // report is always generated after tests run
}

tasks.jacocoTestReport {
    dependsOn(tasks.test) // tests are required to run before generating the report
    reports { xml.required.set(true) }
}

