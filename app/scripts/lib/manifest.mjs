// Builds latest.json. Kept free of I/O so it can be tested on its own.

const DESKTOP = /^(darwin|windows|linux)-/

/**
 * @param previous  the currently published manifest (or null on a first release)
 * @param built     { [platformKey]: entry } for the platforms built in this release
 */
export function buildManifest({ previous, built, version, notes, pubDate }) {
  const platforms = {}

  // A release that only builds some platforms must not drop the rest, or those
  // users silently stop hearing about updates.
  for (const [key, entry] of Object.entries(previous?.platforms ?? {})) {
    if (key in built) continue
    const kept = { ...entry }
    if (DESKTOP.test(key)) {
      // Tauri compares the TOP-LEVEL version with the installed one. Serving an
      // old artifact under a newer top-level version would make the updater
      // install it, believe it's an upgrade, and offer it again forever.
      delete kept.url
      delete kept.signature
    }
    platforms[key] = kept
  }

  for (const [key, entry] of Object.entries(built)) platforms[key] = { ...entry, version }

  return { version, notes, pub_date: pubDate, platforms }
}
