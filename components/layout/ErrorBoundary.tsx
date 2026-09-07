"use client";
import { Component, type ReactNode } from "react";
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="empty-state" role="alert"><strong>This workspace encountered a problem.</strong><p>Your molecule files have not been changed.</p><button className="primary-button" onClick={() => location.reload()}>Reload workspace</button></div>;
    return this.props.children;
  }
}
