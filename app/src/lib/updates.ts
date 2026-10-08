import { useCallback, useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { fetch as httpFetch } from "@tauri-apps/plugin-http"
import * as backend from "./backend"

// ── One manifest, one set of rules ───────────────────────────────
// latest.json is attached to every GitHub Release. The toast and the About
// dialog both go through this module, so they can never disagree about
// whether an update exists.

export const APP_VERSION = __APP_VERSION__
export const MANIFEST_URL = `https://github.com/${__GITHUB_REPO__}/releases/latest/download/latest.json`

const DISMISSED_KEY = "yoink.dismissedUpdate"
const FIRST_CHECK_MS = 10_000
const RECHECK_MS = 60 * 60 * 1000

type PlatformEntry = {
  label?: string
  version: string
  installerUrl?: string
  url?: string
  signature?: string
  size?: number
}
type Manifest = { version: string; notes?: string; pub_date?: string; platforms: Record<string, PlatformEntry> }
export type LatestRelease = { version: string; url: string; notes?: string }

// numeric, part by part: "1.10.0" is newer than "1.9.0"
export function isNewerVersion(a: string, b: string): boolean {
  const parts = (v: string) => v.replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0)
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

// GitHub's release CDN redirects to a host with no CORS headers, so a webview
// fetch is blocked. The HTTP plugin fetches from Rust instead.
export async function fetchManifest(): Promise<Manifest> {
  const res = await httpFetch(MANIFEST_URL, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } })
  if (!res.ok) throw new Error(`Update check failed (${res.status}).`)
  return (await res.json()) as Manifest
}

// each platform is compared against its OWN version, never the top-level one
export async function latestForThisPlatform(): Promise<LatestRelease | null> {
  const [manifest, key] = await Promise.all([fetchManifest(), invoke<string>("platform_key")])
  const entry = manifest.platforms?.[key]
  if (!entry) return null
  const url = entry.installerUrl ?? entry.url
  return url ? { version: entry.version, url, notes: manifest.notes } : null
}

// the button has to say what will actually happen
export const updateActionLabel = () => (backend.isAndroid ? "Download" : "Install")

export async function applyUpdate(latest: LatestRelease): Promise<void> {
  if (backend.isAndroid) {
    // the system package installer takes it from here
    await backend.openUrl(latest.url)
    return
  }
  // lazy: these plugins don't exist on Android, so a static import would break that bundle
  const { check } = await import("@tauri-apps/plugin-updater")
  const { relaunch } = await import("@tauri-apps/plugin-process")
  const update = await check()
  if (!update) throw new Error("No installable update was found for this Mac yet.")
  await update.downloadAndInstall()
  await relaunch()
}

// ── Shared state for the toast and the About dialog ──────────────
export type UpdateStatus = "idle" | "available" | "installing" | "download-needed"

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

export function useUpdates() {
  const [status, setStatus] = useState<UpdateStatus>("idle")
  const [latest, setLatest] = useState<LatestRelease | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(readDismissed)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedOnce, setCheckedOnce] = useState(false)
  const busy = useRef(false)

  // background checks stay quiet when they fail; a manual check says so
  const check = useCallback(async (manual = false) => {
    if (busy.current) return
    busy.current = true
    setChecking(true)
    setError(null)
    try {
      const found = await latestForThisPlatform()
      setCheckedOnce(true)
      if (found && isNewerVersion(found.version, APP_VERSION)) {
        setLatest(found)
        setStatus((s) => (s === "installing" || s === "download-needed" ? s : "available"))
      } else {
        setLatest(null)
        setStatus("idle")
      }
    } catch (e) {
      if (manual) setError(e instanceof Error ? e.message : "Couldn’t check for updates. Are you online?")
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void check(), FIRST_CHECK_MS)
    const every = setInterval(() => void check(), RECHECK_MS)
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [check])

  const install = useCallback(async () => {
    if (!latest) return
    setError(null)
    try {
      if (backend.isAndroid) {
        // the app loses focus the moment the APK opens, so say what's coming first
        setStatus("download-needed")
        await new Promise((r) => setTimeout(r, 1800))
        await applyUpdate(latest)
        setStatus("available")
      } else {
        setStatus("installing")
        await applyUpdate(latest) // relaunches on success
      }
    } catch (e) {
      setStatus("available")
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [latest])

  const dismiss = useCallback(() => {
    if (!latest) return
    setDismissed(latest.version)
    try {
      localStorage.setItem(DISMISSED_KEY, latest.version)
    } catch {
      // not worth failing over
    }
  }, [latest])

  // "Later" hides the toast for this version only; a newer one shows it again
  const showToast = status !== "idle" && latest !== null && dismissed !== latest.version

  return { status, latest, error, checking, checkedOnce, showToast, check, install, dismiss }
}
