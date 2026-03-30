import React from 'react';
import type { PaneInfo } from '../types';

const api = window.electronAPI;

interface PaneHeadersProps {
  panes: PaneInfo[];
  tabStates: Map<string, { isLoading?: boolean; title?: string; favicon?: string }>;
}

export default function PaneHeaders({ panes, tabStates }: PaneHeadersProps) {
  if (panes.length === 0) return null;

  // The first pane's headerBounds origin tells us where the content area starts
  // in absolute window coordinates. browser-container is positioned at that same
  // point in the DOM, so we subtract to get relative positioning.
  const originX = panes[0].headerBounds.x;
  const originY = panes[0].headerBounds.y;

  return (
    <>
      {panes.map(pane => {
        const state = tabStates.get(pane.tabId);
        const title = state?.title || pane.title;
        const { headerBounds } = pane;

        const style: React.CSSProperties = {
          position: 'absolute',
          left: headerBounds.x - originX,
          top: headerBounds.y - originY,
          width: headerBounds.width,
          height: headerBounds.height,
          zIndex: 10,
        };

        return (
          <div key={pane.tabId} className="pane-header" style={style}>
            <span className="pane-header-title" title={title}>
              {state?.isLoading && <span className="pane-header-loading" />}
              {title}
            </span>
            <div className="pane-header-actions">
              <button
                className={`pane-header-btn ${pane.isPinned ? 'active' : ''}`}
                onClick={() => api.togglePinPane(pane.tabId)}
                title={pane.isPinned ? 'Unpin' : 'Pin'}
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.708l-.159-.16-1.768 2.475a2.5 2.5 0 0 1-.654.585l-1.98 1.32-.353 3.536a.5.5 0 0 1-.854.312L6.364 12.3l-3.01 3.01a.5.5 0 0 1-.707-.708l3.01-3.01-2.293-2.293a.5.5 0 0 1 .312-.854l3.536-.354 1.32-1.98a2.5 2.5 0 0 1 .585-.653L11.592 3.69l-.159-.16a.5.5 0 0 1 .354-.854z" />
                </svg>
              </button>
              <button
                className="pane-header-btn pane-header-close"
                onClick={() => api.closePane(pane.tabId)}
                title="Close pane"
              >
                <svg width="8" height="8" viewBox="0 0 10 10">
                  <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
