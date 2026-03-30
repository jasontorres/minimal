import React, { useState, useRef } from 'react';
import type { PaneInfo } from '../types';

const api = window.electronAPI;

interface PaneHeadersProps {
  panes: PaneInfo[];
  tabStates: Map<string, { isLoading?: boolean; title?: string; favicon?: string }>;
}

export default function PaneHeaders({ panes, tabStates }: PaneHeadersProps) {
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  if (panes.length === 0) return null;

  // The first pane's headerBounds origin tells us where the content area starts
  // in absolute window coordinates. browser-container is positioned at that same
  // point in the DOM, so we subtract to get relative positioning.
  const originX = panes[0].headerBounds.x;
  const originY = panes[0].headerBounds.y;

  function handleDragStart(e: React.DragEvent, tabId: string) {
    dragRef.current = tabId;
    setDragTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    // Hide BrowserViews so drop zones are visible
    api.hideViews();
  }

  function handleDragOver(e: React.DragEvent, tabId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tabId !== dragRef.current) {
      setDropTargetId(tabId);
    }
  }

  function handleDragLeave(_e: React.DragEvent, tabId: string) {
    if (dropTargetId === tabId) {
      setDropTargetId(null);
    }
  }

  function handleDrop(e: React.DragEvent, tabId: string) {
    e.preventDefault();
    const sourceId = dragRef.current;
    if (sourceId && sourceId !== tabId) {
      api.swapPanes(sourceId, tabId);
    }
    cleanup();
    api.showViews();
  }

  function handleDragEnd() {
    cleanup();
    api.showViews();
  }

  function cleanup() {
    dragRef.current = null;
    setDragTabId(null);
    setDropTargetId(null);
  }

  return (
    <>
      {panes.map(pane => {
        const state = tabStates.get(pane.tabId);
        const title = state?.title || pane.title;
        const { headerBounds } = pane;
        const isDragging = dragTabId === pane.tabId;
        const isDropTarget = dropTargetId === pane.tabId;

        const style: React.CSSProperties = {
          position: 'absolute',
          left: headerBounds.x - originX,
          top: headerBounds.y - originY,
          width: headerBounds.width,
          height: headerBounds.height,
          zIndex: isDragging ? 20 : 10,
          opacity: isDragging ? 0.6 : 1,
        };

        return (
          <div
            key={pane.tabId}
            className={`pane-header ${isDropTarget ? 'pane-header-drop-target' : ''}`}
            style={style}
            draggable
            onDragStart={e => handleDragStart(e, pane.tabId)}
            onDragOver={e => handleDragOver(e, pane.tabId)}
            onDragLeave={e => handleDragLeave(e, pane.tabId)}
            onDrop={e => handleDrop(e, pane.tabId)}
            onDragEnd={handleDragEnd}
          >
            <span className="pane-header-drag-handle" title="Drag to reorder">
              <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" opacity="0.4">
                <circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" />
                <circle cx="2" cy="5" r="1" /><circle cx="6" cy="5" r="1" />
                <circle cx="2" cy="8" r="1" /><circle cx="6" cy="8" r="1" />
              </svg>
            </span>
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
