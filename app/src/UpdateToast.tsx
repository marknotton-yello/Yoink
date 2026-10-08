import { updateActionLabel, type useUpdates } from "./lib/updates"

type Updates = ReturnType<typeof useUpdates>

export function UpdateToast({ updates }: { updates: Updates }) {
  const { status, latest, error, showToast, install, dismiss } = updates
  if (!showToast || !latest) return null

  return (
    <aside className="toast" role="status">
      {status === "installing" ? (
        <p className="toast__text"><span className="spinner" /> Updating… the app will restart itself.</p>
      ) : status === "download-needed" ? (
        <p className="toast__text">Android will ask you to confirm the install.</p>
      ) : (
        <>
          <div className="toast__head">
            <p className="toast__text"><strong>Yoink {latest.version}</strong> is available.</p>
            <button className="toast__close" onClick={dismiss} aria-label="Dismiss">✕</button>
          </div>
          {latest.notes && <p className="toast__notes">{latest.notes}</p>}
          {error && <p className="toast__error">{error}</p>}
          <div className="toast__actions">
            <button className="btn btn--ghost" onClick={dismiss}>Later</button>
            <button className="btn btn--primary" onClick={() => void install()}>{updateActionLabel()}</button>
          </div>
        </>
      )}
    </aside>
  )
}
