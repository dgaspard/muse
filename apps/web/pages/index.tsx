// Minimal Next.js page for prototype
// This page provides links to service health endpoints so you can verify services quickly.
import React from 'react'
import Link from 'next/link'

export default function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const pipeline = process.env.NEXT_PUBLIC_PIPELINE_URL || 'http://localhost:8000'

  return (
    <main style={{padding: 40, fontFamily: 'Arial'}}>
      <h1>Muse (prototype)</h1>
      <p>This is a minimal Next.js frontend used for development and quick checks.</p>

      <h2>Workflows</h2>
      <ul>
        <li><Link href="/governance">Governance-to-Delivery Pipeline (MUSE-008)</Link></li>
        <li><Link href="/upload">Simple Document Upload</Link></li>
      </ul>

      <h2>Health</h2>
      <ul>
        <li><a href={`${api}/health`} target="_blank" rel="noreferrer">API health</a></li>
        <li><a href={`${pipeline}/health`} target="_blank" rel="noreferrer">Pipeline health</a></li>
      </ul>

      <p style={{color: '#666'}}>Note: This project is a scaffold—business logic lives in services and is not implemented yet.</p>
    </main>
  )
}
