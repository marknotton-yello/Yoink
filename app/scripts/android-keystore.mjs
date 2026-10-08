#!/usr/bin/env node
// One-time setup: creates the Android release keystore AND keystore.properties
// from the same password in one go, then checks they agree. Android refuses to
// install an update signed with a different certificate, so BACK IT UP.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ask, passwordFromEnvOrPrompt } from "./lib/prompt.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
// outside src-tauri/gen/, which `tauri android init` regenerates wholesale
const SIGNING = path.join(ROOT, "src-tauri", "signing")
const STORE = path.join(SIGNING, "yoink.jks")
const PROPS = path.join(SIGNING, "keystore.properties")
const ALIAS = "yoink"

fs.mkdirSync(SIGNING, { recursive: true })

if (fs.existsSync(STORE)) {
  if (process.env.ANDROID_KEYSTORE_REPLACE !== "yes") {
    console.log(`\nA keystore already exists at ${path.relative(ROOT, STORE)}.`)
    console.log("A new one means a different certificate: phones with the app installed will refuse every future update until it's uninstalled.")
    const answer = await ask("Type REPLACE to continue, anything else to cancel: ")
    if (answer.trim() !== "REPLACE") {
      console.log("Cancelled. Nothing changed.")
      process.exit(0)
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  fs.renameSync(STORE, `${STORE}.old-${stamp}`)
  if (fs.existsSync(PROPS)) fs.renameSync(PROPS, `${PROPS}.old-${stamp}`)
}

const password = await passwordFromEnvOrPrompt("ANDROID_KEYSTORE_PASSWORD", "Keystore password (6+ characters): ")
if (password.length < 6) {
  console.error("keytool needs at least 6 characters.")
  process.exit(1)
}

const keytool = (args) => execFileSync("keytool", args, { stdio: ["ignore", "pipe", "pipe"] }).toString()

keytool([
  "-genkeypair", "-keystore", STORE, "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
  "-storepass", password, "-keypass", password, "-dname", "CN=Yoink",
])
// one password for both, written from the same variable so they can't drift apart
fs.writeFileSync(PROPS, `storeFile=yoink.jks\nstorePassword=${password}\nkeyAlias=${ALIAS}\nkeyPassword=${password}\n`)
fs.chmodSync(STORE, 0o600)
fs.chmodSync(PROPS, 0o600)

// prove it: the password we just wrote opens the keystore we just made
try {
  const props = Object.fromEntries(fs.readFileSync(PROPS, "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)))
  keytool(["-list", "-keystore", path.join(SIGNING, props.storeFile), "-storepass", props.storePassword, "-alias", props.keyAlias])
} catch (e) {
  console.error("Verification failed: the keystore and keystore.properties don't agree.\n", e.stderr?.toString() ?? e.message)
  process.exit(1)
}

console.log(`
✓ Keystore created and verified.

  BACK UP THESE NOW:  src-tauri/signing/yoink.jks
                      src-tauri/signing/keystore.properties
  Lose them and the Android app can never update in place again:
  it would need a new package name and everyone would reinstall.

Both are gitignored. Never commit them.`)
