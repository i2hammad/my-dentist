import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { imgUrl } from '../lib/api';

// Full-screen image overlay. `src` may be raw (/uploads/..) or absolute — imgUrl
// is idempotent so it's safe either way. Click backdrop / X / Escape to close.
export function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!src) return null;
  return (
    <div className="lightbox-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close"><X size={20} weight="bold" /></button>
      <div className="lightbox-inner">
        <img className="lightbox-img" src={imgUrl(src)} alt={caption || ''} />
        {caption ? <div className="lightbox-caption">{caption}</div> : null}
      </div>
    </div>
  );
}

// Drop-in replacement for <img> that opens a Lightbox on click. Pass the raw
// src; styling via className/style is forwarded to the thumbnail.
export function ZoomImg({ src, alt, caption, className, style, fallback }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return fallback !== undefined ? fallback : <div className={className} style={{ ...style, background: '#eef2f7' }} />;
  }
  return (
    <>
      <img
        className={(className ? className + ' ' : '') + 'zoomable'}
        style={style}
        src={imgUrl(src)}
        alt={alt || ''}
        onError={() => setBroken(true)}
        onClick={() => setOpen(true)}
      />
      {open && <Lightbox src={src} caption={caption || alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export default Lightbox;
