// ── Wordmark: dithered pixel letters in the accent colour ────────
// viewBox is cropped to the artwork (200×50) so it centres properly.
import { useId } from "react"

export function Logo({ className = "logo" }: { className?: string }) {
  // each instance needs its own pattern id, or one logo unmounting breaks the other
  const id = `dither-${useId().replace(/:/g, "")}`
  return (
    <svg className={className} viewBox="0 0 200 50" role="img" aria-label="yoinks" fill="currentColor">
      <defs>
        <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M0 0h2.5v2.5H0zM2.5 2.5H5V5H2.5z" />
        </pattern>
      </defs>
      <g fill={`url(#${id})`}>
        <path d="M0 0h10v20H0zM20 0h10v20H20zM60 20h10v20H60zM90 20h10v20H90zM150 20h10v20h-10zM170 20h10v20h-10z" />
      </g>
      <path d="M40 0h10v20H40zM50 0h10v10H50zM60 0h10v20H60zM80 0h10v10H80zM90 0h10v20H90zM100 0h10v10h-10zM120 0h10v20h-10zM130 0h10v10h-10zM140 10h10v10h-10zM150 0h10v20h-10zM170 0h10v20h-10zM190 0h10v20h-10zM0 20h10v10H0zM10 20h10v20H10zM20 20h10v10H20zM40 20h10v20H40zM120 20h10v20h-10zM180 20h10v10h-10zM190 30h10v10h-10zM10 40h10v10H10zM40 40h10v10H40zM50 40h10v10H50zM60 40h10v10H60zM80 40h10v10H80zM90 40h10v10H90zM100 40h10v10h-10zM120 40h10v10h-10zM150 40h10v10h-10zM170 40h10v10h-10zM190 40h10v10h-10z" />
    </svg>
  )
}
