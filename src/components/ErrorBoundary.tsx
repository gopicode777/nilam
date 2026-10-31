import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/errors';

/** If a page crashes, show a calm message instead of a blank screen, and report the error. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: Error) { reportError(err.message, err.stack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
      <div><h2 style={{ marginBottom: 6 }}>Something went wrong / ஏதோ தவறு நடந்தது</h2>
        <p style={{ color: 'var(--mu)', margin: '0 0 16px' }}>We have been told about it. Please reload the page.<br />எங்களுக்கு தெரிவிக்கப்பட்டது. பக்கத்தை மீண்டும் ஏற்றவும்.</p>
        <button className="btn" onClick={() => window.location.reload()}>Reload / மீண்டும் ஏற்று</button></div>
    </div>;
  }
}
