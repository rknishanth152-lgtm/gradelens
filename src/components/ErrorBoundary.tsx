import { Component, type ReactNode } from 'react';

/** Last line of defence: never leave a student on a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  reset = () => {
    try {
      localStorage.removeItem('gradelens:v1');
    } catch {
      /* ignore */
    }
    location.hash = '';
    location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-[30px] font-extrabold tracking-[-0.03em] text-fg">Something went wrong</h1>
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">The page hit an unexpected problem. Starting fresh clears the marks saved on this phone and reloads GradeLens.</p>
        <div className="mt-6 flex flex-col gap-2">
          <button type="button" onClick={this.reset} className="press min-h-12 cursor-pointer rounded-[14px] bg-pen-strong px-5 text-[15.5px] font-semibold text-on-pen">
            Start fresh
          </button>
          <button type="button" onClick={() => location.reload()} className="press min-h-12 cursor-pointer rounded-[14px] border-[1.5px] border-line-strong px-5 text-[15.5px] font-semibold text-fg">
            Just reload
          </button>
        </div>
      </div>
    );
  }
}
