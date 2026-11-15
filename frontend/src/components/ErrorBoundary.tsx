// Hata sınırı: bir bileşen beklenmedik veriyle çökerse tüm ekran boş kalmasın; kullanıcıya yenileme seçeneği sunulur.
// AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error('[ui]', e); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, color: '#e8eef6', fontFamily: 'sans-serif' }}>
        <p>Bu bölüm görüntülenemedi. / This section could not be displayed.</p>
        <button onClick={() => { this.props.onReset?.(); this.setState({ failed: false }); }}>Yeniden dene / Retry</button>
      </div>
    );
  }
}
