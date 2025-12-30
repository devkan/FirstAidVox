import React from 'react'
import ReactDOM from 'react-dom/client'
import { SendButtonTest } from './components/chat/SendButtonTest'
import './index.css'

ReactDOM.createRoot(document.getElementById('debug-root')!).render(
  <React.StrictMode>
    <SendButtonTest />
  </React.StrictMode>,
)