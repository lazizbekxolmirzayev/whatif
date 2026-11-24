'use client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './strategy.css'
import { initAuth } from './services/auth'

/**
 * Client-only entry of the Grand Strategy game (integrated from PAXAILOVASI).
 * The game keeps its own router, mounted under /strategy; the WHATIF site serves every
 * /strategy/* URL with the same page, so deep links and reloads work.
 */
let started = false
if (!started) {
  started = true
  void initAuth()
}

export default function StrategyApp() {
  return (
    <BrowserRouter basename="/strategy">
      <App />
    </BrowserRouter>
  )
}
