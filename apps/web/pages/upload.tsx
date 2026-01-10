import React, { useState } from 'react'

export default function UploadPage() {
  const [projectId, setProjectId] = useState('demo-project')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setStatus('Please select a file')
      return
    }

    const fd = new FormData()
    fd.append('projectId', projectId)
    fd.append('file', file)

    setStatus('Uploading...')

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (data.ok) {
        setStatus(`Upload successful — documentId=${data.documentId}`)
      } else {
        setStatus(`Upload failed: ${data.error || 'unknown error'}`)
      }
    } catch (err) {
      setStatus('Upload failed: network error')
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Muse — Upload Governance Document</h1>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Project ID
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            File
            <input
              type="file"
              accept=".docx,application/pdf,.txt"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>
        <button type="submit">Upload</button>
      </form>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
    </div>
  )
}
