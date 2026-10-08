#!/usr/bin/env node
// One-time setup: creates the updater signing key and wires its public half
// into tauri.conf.json. The app refuses any update not signed by this key, so
// BACK IT UP: lose it and no installed copy can ever auto-update again.
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ask, passwordFromEnvOrPrompt } from "./lib/prompt.mjs"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SIGNING = path.join(ROOT, "src-tauri", "signing")
const KEY = path.join(SIGNING, "updater.key")
const PUB = `${KEY}.pub`
const CONF = path.join(ROOT, "src-tauri", "tauri.conf.json")
const TAURI = path.join(ROOT, "node_modules", ".bin", "tauri")

fs.mkdirSync(SIGNING, { recursive: true })

if (fs.existsSync(KEY)) {
  const yes = process.env.UPDATER_KEY_REPLACE === "yes"
  if (!yes) {
    console.log(`\nAn updater key already exists at ${path.relative(ROOT, KEY)}.`)
    console.log("Replacing it means EVERY installed copy stops being able to update; people would have to reinstall by hand.")
    const answer = await ask('Type REPLACE to continue, anything else to cancel: ')
    if (answer.trim() !== "REPLACE") {
      console.log("Cancelled. Nothing changed.")
      process.exit(0)
    }
  }
  // move aside, never delete
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  fs.renameSync(KEY, `${KEY}.old-${stamp}`)
  if (fs.existsSync(PUB)) fs.renameSync(PUB, `${PUB}.old-${stamp}`)
  console.log(`Old key moved to ${path.relative(ROOT, KEY)}.old-${stamp}`)
}

const password = await passwordFromEnvOrPrompt("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "Password for the new key (empty is allowed): ")

execFileSync(TAURI, ["signer", "generate", "--ci", "-w", KEY, "-p", password], { stdio: "inherit", cwd: ROOT })
fs.chmodSync(KEY, 0o600)

// write the public key into the config ourselves; a hand-pasted, mismatched
// one only fails months later with a signature error that explains nothing
const conf = JSON.parse(fs.readFileSync(CONF, "utf8"))
conf.plugins ??= {}
conf.plugins.updater ??= {}
conf.plugins.updater.pubkey = fs.readFileSync(PUB, "utf8").trim()
// Tauri refuses to build with this on and no pubkey, so it only turns on once a key exists
conf.bundle.createUpdaterArtifacts = true
fs.writeFileSync(CONF, `${JSON.stringify(conf, null, 2)}\n`)

// keep it out of git
const gitignore = path.join(ROOT, ".gitignore")
const ignored = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, "utf8") : ""
if (!ignored.includes("src-tauri/signing/")) fs.appendFileSync(gitignore, "\nsrc-tauri/signing/\n")

console.log(`
✓ Updater key created and the public key written to tauri.conf.json.

  BACK UP THIS NOW:  ${path.relative(ROOT, KEY)}
  (and its password) somewhere safe. If it's lost, every installed
  copy of the app is stuck on its current version for good.

Commit the tauri.conf.json change. Never commit the key.`)
