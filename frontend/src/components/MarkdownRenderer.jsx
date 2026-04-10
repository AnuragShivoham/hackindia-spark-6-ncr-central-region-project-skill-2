import React from 'react';

/**
 * A lightweight Markdown renderer for AI Counselor responses.
 * Uses CSS pre-wrap and basic pattern matching for code/bold text.
 */
const MarkdownRenderer = ({ content }) => {
    if (!content) return null;

    // Simple parser for basic formatting if full markdown isn't needed
    const formatLine = (line) => {
        // Handle bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Handle inline code
        line = line.replace(/`(.*?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 2px 4px; borderRadius: 4px; font-family: monospace">$1</code>');
        return line;
    };

    const lines = content.split('\n');
    let isInCodeBlock = false;

    return (
        <div style={styles.container}>
            {lines.map((line, i) => {
                if (line.trim().startsWith('```')) {
                    isInCodeBlock = !isInCodeBlock;
                    return null;
                }

                if (isInCodeBlock) {
                    return (
                        <div key={i} style={styles.codeLine}>
                            {line}
                        </div>
                    );
                }

                return (
                    <div 
                        key={i} 
                        style={styles.textLine} 
                        dangerouslySetInnerHTML={{ __html: formatLine(line) || '&nbsp;' }} 
                    />
                );
            })}
        </div>
    );
};

const styles = {
    container: {
        fontSize: '13px',
        lineHeight: '1.6',
        color: '#e6edf3',
        wordBreak: 'break-word'
    },
    textLine: {
        marginBottom: '8px'
    },
    codeLine: {
        fontFamily: '"Fira Code", monospace',
        background: '#0d1117',
        padding: '2px 8px',
        borderLeft: '2px solid #30363d',
        color: '#79c0ff',
        fontSize: '12px',
        whiteSpace: 'pre'
    }
};

export default MarkdownRenderer;
