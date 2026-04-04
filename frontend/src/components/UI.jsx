// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  return <span className={`badge b-${status}`}>{(status || '').replace(/_/g,' ')}</span>;
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct }) {
  return <div className="ptrack"><div className="pfill" style={{ width: `${Math.min(pct||0,100)}%` }} /></div>;
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────
export function Spinner() { return <div className="spin" />; }

// ─── TERMINAL BLOCK ───────────────────────────────────────────────────────────
export function TermBlock({ lines = [], label }) {
  return (
    <div className="term">
      <div className="term-hdr">
        <div className="dot" style={{background:'#ff5f57'}} />
        <div className="dot" style={{background:'#febc2e'}} />
        <div className="dot" style={{background:'#28c840'}} />
        {label && <span style={{fontSize:10,color:'var(--tx-d)',marginLeft:6,letterSpacing:'0.1em'}}>{label}</span>}
      </div>
      <div className="term-body">
        {(Array.isArray(lines) ? lines : []).map((line, i) => (
          <div key={i} className="tl">
            {line.startsWith('$')
              ? <><span className="tp">$</span><span className="tc">{line.slice(1).trim()}</span></>
              : line.startsWith('#')
              ? <span className="tcm">{line}</span>
              : <span style={{color:'var(--tx-m)'}}>{line}</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FOLDER TREE ──────────────────────────────────────────────────────────────
export function FolderTree({ tree, depth = 0 }) {
  if (!tree || typeof tree !== 'object') return null;
  return (
    <div className="ftree" style={{ paddingLeft: depth * 14 }}>
      {Object.entries(tree || {}).map(([key, val]) => (
        <div key={key}>
          <span className={val === null ? 'ftfile' : 'ftdir'}>
            {val === null ? '  📄 ' : '  📁 '}{key}
          </span>
          {val && typeof val === 'object' && <FolderTree tree={val} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

// ─── CODE BLOCK ───────────────────────────────────────────────────────────────
export function CodeBlock({ code }) {
  if (typeof code !== 'string') return null;
  return (
    <pre className="code">
      {code.split('\n').map((line, i) => (
        <div key={i} className={line.includes('TODO') ? 'todo-line' : ''}>{line}</div>
      ))}
    </pre>
  );
}

// ─── QA PANEL ─────────────────────────────────────────────────────────────────
export function QAPanel({ review, onDismiss }) {
  if (!review) return null;
  const v   = review.verdict;
  const cls = v === 'pass' ? 'qa-pass' : v === 'partial' ? 'qa-partial' : 'qa-fail';
  const icon= v === 'pass' ? '✓' : v === 'partial' ? '◑' : '✗';
  const sev_color = s => s === 'critical' ? 'var(--red)' : s === 'warning' ? 'var(--amber)' : 'var(--tx-m)';

  return (
    <div className={`qa ${cls} fade-in`}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:18}}>{icon}</span>
          <StatusBadge status={v} />
          <span style={{fontSize:11,color:'var(--tx-m)',fontFamily:'var(--mono)'}}>{Math.round((review.score||0)*100)}%</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} style={{background:'none',border:'none',color:'var(--tx-d)',cursor:'pointer',fontSize:16}}>✕</button>
        )}
      </div>
      <p style={{fontSize:13,color:'var(--tx)',lineHeight:1.7,marginBottom:12,fontStyle:'italic'}}>
        "{review.feedback_text}"
      </p>
      <div style={{marginBottom:10}}>
        {(Array.isArray(review.passed_checks) ? review.passed_checks : []).map((c,i) => <div key={i} className="qc-pass">✓ {c}</div>)}
        {(Array.isArray(review.failed_checks) ? review.failed_checks : []).map((c,i) => <div key={i} className="qc-fail">✗ {c}</div>)}
      </div>
      {review.corrections?.length > 0 && (
        <>
          <div className="lbl" style={{marginTop:12}}>Corrections</div>
          {(Array.isArray(review.corrections) ? review.corrections : []).map((c,i) => (
            <div key={i} className={`corr corr-${c.severity}`}>
              <div className="corr-lbl" style={{color: sev_color(c.severity)}}>[{c.severity}] {c.issue}</div>
              <div className="corr-hint">→ {c.hint}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
