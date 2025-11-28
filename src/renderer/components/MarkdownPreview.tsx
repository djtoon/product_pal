import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import './MarkdownPreview.css';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
});

interface MarkdownPreviewProps {
  content: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (previewRef.current) {
      try {
        const html = marked.parse(content || '');
        previewRef.current.innerHTML = html as string;
        setError(null);
      } catch (err) {
        console.error('Markdown parsing error:', err);
        setError('Error rendering markdown preview');
      }
    }
  }, [content]);

  return (
    <div className="markdown-preview">
      <div className="markdown-preview-header">Preview</div>
      <div className="markdown-preview-content" ref={previewRef}>
        {error && <div style={{ color: '#f48771', padding: '20px' }}>{error}</div>}
      </div>
    </div>
  );
};

export default MarkdownPreview;

