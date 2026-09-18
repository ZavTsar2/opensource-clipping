import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="studio-shell"><section className="workspace"><div className="notice error"><b>Clip Studio could not start in this browser.</b> Open Safari Settings → Safari → Advanced → Website Data, remove this site's data, then reload.</div></section></main>
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary><App /></AppErrorBoundary>,
)
