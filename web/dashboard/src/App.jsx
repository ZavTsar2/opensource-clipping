import { useEffect, useMemo, useState } from 'react'
import { createJob, fetchHealth, fetchJob, fetchMedia, getConnection, saveConnection } from './api'

const HISTORY_KEY = 'clip-studio-history'
const ACTIVE_STATES = new Set(['queued', 'downloading', 'transcribing', 'analyzing', 'rendering'])

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] }
}

export default function App() {
  const [connection, setConnection] = useState(getConnection)
  const [draft, setDraft] = useState(getConnection)
  const [showConnect, setShowConnect] = useState(!getConnection().url)
  const [health, setHealth] = useState(null)
  const [url, setUrl] = useState('')
  const [clips, setClips] = useState(5)
  const [captions, setCaptions] = useState('on')
  const [category, setCategory] = useState('viral')
  const [jobs, setJobs] = useState(readHistory)
  const [error, setError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshingId, setRefreshingId] = useState('')
  const activeJob = useMemo(() => jobs.find((job) => ACTIVE_STATES.has(job.status)), [jobs])

  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs.slice(0, 12))) }, [jobs])
  useEffect(() => {
    if (!activeJob || !connection.url) return undefined
    const timer = window.setInterval(() => refreshJob(activeJob.id, false), 1500)
    return () => window.clearInterval(timer)
  }, [activeJob?.id, connection.url])
  useEffect(() => { if (connection.url && connection.token) testConnection(connection) }, [])

  async function testConnection(candidate = draft) {
    const normalized = { url: candidate.url.trim().replace(/\/$/, ''), token: candidate.token.trim() }
    if (!normalized.url || !normalized.token) return setError('Paste both the notebook tunnel URL and its personal access token.')
    setConnecting(true); setError(''); saveConnection(normalized)
    try {
      const result = await fetchHealth()
      setConnection(normalized); setDraft(normalized); setHealth(result); setShowConnect(false)
    } catch (err) { setHealth(null); setError(err.message) } finally { setConnecting(false) }
  }

  async function refreshJob(id, showLoading = true) {
    if (showLoading) setRefreshingId(id)
    try {
      const job = await fetchJob(id)
      setJobs((current) => current.map((item) => item.id === id ? { ...item, ...job } : item))
    } catch (err) { setError(err.message) } finally { if (showLoading) setRefreshingId('') }
  }

  async function startJob(event) {
    event.preventDefault(); setError('')
    if (!isYoutubeUrl(url)) return setError('Paste a valid YouTube watch, short, or youtu.be link.')
    if (!health) return setError('Connect your notebook before creating a job.')
    setSubmitting(true)
    try {
      const job = await createJob({
        url: url.trim(), source: 'youtube', clips, ratio: '9:16', source_height: '1080', render_height: '1080',
        min_clip_seconds: 30, max_clip_seconds: 75, clip_category: category,
        font_style: 'HORMOZI', ai_provider: 'gemini', gemini_model: 'gemini-3-flash-preview', face_detector: 'mediapipe',
        use_dlp_subs: true, whisper_model: 'large-v3', whisper_device: 'cuda', use_karaoke_effect: captions === 'on',
        use_broll: false, use_hook_glitch: false, use_auto_bgm: false, use_split_screen: false, use_camera_switch: false, no_subs: captions === 'off',
      })
      setJobs((current) => [{ ...job, savedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== job.id)])
      setUrl('')
    } catch (err) { setError(err.message) } finally { setSubmitting(false) }
  }

  return <main className="studio-shell">
    <header className="topbar"><a className="brand" href="."><span className="brand-mark">C</span><span>Clip Studio</span></a><button className={`connection ${health ? 'online' : ''}`} onClick={() => setShowConnect(true)}><i />{health ? 'Notebook connected' : 'Connect notebook'}</button></header>
    <section className="hero"><p className="eyebrow">PERSONAL CREATOR WORKSPACE</p><h1>Turn long videos into<br /><em>short-form clips.</em></h1><p className="lede">Paste a YouTube link. Your private GPU notebook finds the best moments, frames them for vertical, and returns downloads ready for posting.</p></section>
    <section className="workspace">
      <form className="create-card" onSubmit={startJob}><label htmlFor="youtube-url">YouTube video link</label><div className="url-row"><span className="link-icon">↗</span><input id="youtube-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." inputMode="url" /><button className="primary" disabled={submitting || !health}>{submitting ? 'Starting...' : 'Create clips'}</button></div><p className="source-note">For videos you own or are authorized to repurpose. Facebook support is intentionally not included in this first release.</p><div className="settings-row"><div><span>OUTPUT</span><strong>9:16 · 1080p</strong></div><label className="compact-field"><span>CLIPS</span><select value={clips} onChange={(event) => setClips(Number(event.target.value))}><option value="3">3 clips</option><option value="4">4 clips</option><option value="5">5 clips</option></select></label><div><span>LENGTH</span><strong>30–75 sec</strong></div><div><span>PRESET</span><strong>Balanced</strong></div></div><div className="creator-controls"><label className="compact-field"><span>CAPTIONS</span><select value={captions} onChange={(event) => setCaptions(event.target.value)}><option value="on">On · karaoke</option><option value="off">Off · clean video</option></select></label><label className="compact-field"><span>CLIP STYLE</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="viral">Viral / engaging</option><option value="funny">Funny / entertaining</option><option value="serious">Serious / emotional</option><option value="educational">Educational / insights</option></select></label></div></form>
      {error && <div className="notice error"><b>Couldn't continue.</b> {error}</div>}
      {activeJob && <ProgressCard job={activeJob} refreshing={refreshingId === activeJob.id} onRefresh={() => refreshJob(activeJob.id)} />}
      <Jobs jobs={jobs} refreshingId={refreshingId} onRefresh={refreshJob} />
    </section>
    <footer>Jobs and download links are saved in this browser only. Download completed clips before the notebook session ends.</footer>
    {showConnect && <ConnectionDialog draft={draft} setDraft={setDraft} connecting={connecting} onConnect={testConnection} onClose={() => setShowConnect(false)} />}
  </main>
}

function ConnectionDialog({ draft, setDraft, connecting, onConnect, onClose }) {
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="connection-title"><button className="close" onClick={onClose} aria-label="Close">×</button><p className="eyebrow">ONE-TIME SETUP</p><h2 id="connection-title">Connect your notebook</h2><p>Start the Kaggle or Colab server, then paste its temporary HTTPS tunnel and the <code>CLIP_STUDIO_TOKEN</code> you created there.</p><label>Notebook tunnel URL<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} placeholder="https://your-tunnel.example" /></label><label>Personal access token<input type="password" value={draft.token} onChange={(event) => setDraft({ ...draft, token: event.target.value })} placeholder="Stored in this browser only" /></label><button className="primary full" onClick={() => onConnect(draft)} disabled={connecting}>{connecting ? 'Testing connection...' : 'Test & connect'}</button><p className="dialog-help">Your Gemini key stays in notebook secrets—it is never entered here.</p></section></div>
}

function ProgressCard({ job, onRefresh, refreshing }) {
  const progress = job.progress || {}; const percent = Math.max(4, Math.round(progress.percent || 0))
  return <section className="progress-card"><div><p className="eyebrow">CURRENT JOB</p><h2>{stageName(job.status)}</h2><p>{progress.message || 'Your notebook has queued this clip job.'}</p></div><button className="text-button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button><div className="progress"><i style={{ width: `${percent}%` }} /></div><small>{percent}% · {job.config?.clips || 5} clips requested</small></section>
}

function formatTimestamp(seconds) { const value = Math.max(0, Math.round(seconds || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}` }

function Jobs({ jobs, onRefresh, refreshingId }) {
  const completed = jobs.filter((job) => job.status === 'completed')
  if (!jobs.length) return <section className="empty"><div className="empty-orb">✦</div><h2>Your clips will appear here</h2><p>Connect your notebook, paste a YouTube link, and create your first vertical short.</p></section>
  return <section className="history"><div className="section-heading"><div><p className="eyebrow">LOCAL HISTORY</p><h2>{completed.length ? 'Ready to download' : 'Recent jobs'}</h2></div><span>Session links can expire</span></div>{jobs.map((job) => <JobCard job={job} key={job.id} refreshing={refreshingId === job.id} onRefresh={onRefresh} />)}</section>
}

function JobCard({ job, onRefresh, refreshing }) {
  const [media, setMedia] = useState({}); const [thumbnails, setThumbnails] = useState({}); const [loading, setLoading] = useState({}); const [mediaError, setMediaError] = useState('')
  useEffect(() => {
    let cancelled = false
    for (const clip of job.clips || []) {
      if (!clip.thumbnail_url) continue
      fetchMedia(clip.thumbnail_url).then((thumbnail) => {
        if (!cancelled) setThumbnails((current) => ({ ...current, [clip.filename]: thumbnail }))
      }).catch(() => {})
    }
    return () => { cancelled = true }
  }, [job.id])
  async function loadClip(clip) {
    if (media[clip.filename]) return media[clip.filename]
    if (loading[clip.filename]) return null
    setLoading((current) => ({ ...current, [clip.filename]: { action: 'preview', progress: 0 } }))
    try {
      const mediaUrl = await fetchMedia(clip.download_url, (progress) => setLoading((current) => ({ ...current, [clip.filename]: { action: 'preview', progress } })))
      setMedia((current) => ({ ...current, [clip.filename]: mediaUrl }))
      return mediaUrl
    } catch (err) { setMediaError(err.message); return null } finally { setLoading((current) => { const next = { ...current }; delete next[clip.filename]; return next }) }
  }
  async function downloadClip(clip) {
    let mediaUrl = media[clip.filename]
    if (!mediaUrl) {
      setLoading((current) => ({ ...current, [clip.filename]: { action: 'download', progress: 0 } }))
      try {
        mediaUrl = await fetchMedia(clip.download_url, (progress) => setLoading((current) => ({ ...current, [clip.filename]: { action: 'download', progress } })))
        setMedia((current) => ({ ...current, [clip.filename]: mediaUrl }))
      } catch (err) { setMediaError(err.message); return } finally { setLoading((current) => { const next = { ...current }; delete next[clip.filename]; return next }) }
    }
    const link = document.createElement('a'); link.href = mediaUrl; link.download = clip.filename; link.click()
  }
  return <article className="job-card"><div className="job-top"><div><span className={`status ${job.status}`}>{job.status || 'saved'}</span><h3>{job.url || 'Previous clip job'}</h3></div><button className="text-button" onClick={() => onRefresh(job.id)}>Refresh</button></div>{job.error && <p className="job-error">{job.error}</p>}{job.status === 'completed' && <div className="clip-grid">{(job.clips || []).map((clip) => { const state = loading[clip.filename]; return <div className="clip" key={clip.filename}><div className="clip-preview">{media[clip.filename] ? <video src={media[clip.filename]} controls preload="metadata" /> : <><>{thumbnails[clip.filename] && <img src={thumbnails[clip.filename]} alt="Clip preview" />}</><button onClick={() => loadClip(clip)} disabled={Boolean(state)}>{state?.action === 'preview' ? `Loading${state.progress ? ` ${state.progress}%` : '...'}` : 'Load preview'}</button></>}</div><div><b>#{clip.rank} {clip.title || clip.title_en || 'Clip'}</b><span>{clip.duration ? `${Math.round(clip.duration)} sec` : 'Ready'}{typeof clip.start_time === 'number' && typeof clip.end_time === 'number' ? ` · ${formatTimestamp(clip.start_time)}–${formatTimestamp(clip.end_time)}` : ''}{clip.viral_score ? ` · Score ${clip.viral_score}` : ''}</span><button className="text-button" onClick={() => downloadClip(clip)} disabled={Boolean(state)}>{state?.action === 'download' ? `Downloading${state.progress ? ` ${state.progress}%` : '...'}` : 'Download MP4'}</button></div></div>})}</div>}{mediaError && <p className="job-error">{mediaError}</p>}</article>
}

function stageName(status) { return ({ queued: 'Queued for processing', downloading: 'Downloading source', transcribing: 'Preparing captions', analyzing: 'Finding strong moments', rendering: 'Rendering your clips' })[status] || 'Working on your clips' }
function isYoutubeUrl(value) { try { const host = new URL(value.trim()).hostname.replace('www.', ''); return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' } catch { return false } }
