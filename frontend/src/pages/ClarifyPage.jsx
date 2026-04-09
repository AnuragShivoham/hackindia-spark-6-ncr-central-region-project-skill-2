import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { 
    BrainCircuit, ArrowRight, ArrowLeft, 
    MessageSquare, Loader2, Rocket, Sparkles, CheckCircle2 
} from 'lucide-react';

export default function ClarifyPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { applyResponse, setSuccessMsg, project } = useStore();
    
    // Support either direct questions or formatted questions from navigation
    const questions = location.state?.questions || [];
    const message = location.state?.message || "Architect is analyzing your vision...";
    const pid = location.state?.projectId || project?.id;

    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [loading, setLoad] = useState(false);
    const [error, setError] = useState('');

    const totalSteps = questions.length;
    const currentQuestion = questions[currentStep];

    const handleNext = () => {
        if (!answers[currentQuestion?.id]?.trim()) {
            setError("Please share your thoughts for this step.");
            return;
        }
        setError("");
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        setLoad(true);
        setError('');
        try {
            const res = await api.clarifyGoal(pid, answers);
            if (res.action === 'rejected') {
                setError(res.message);
                setLoad(false);
                return;
            }
            applyResponse(res);
            
            if (res.action === 'clarify') {
                navigate('/clarify', { 
                    state: { 
                        questions: res.questions, 
                        projectId: pid,
                        message: res.message 
                    }, 
                    replace: true 
                });
                setCurrentStep(0); // Reset for new questions
            } else if (res.action === 'milestones_generated') {
                setSuccessMsg(res.message);
                navigate('/confirm-plan');
            } else if (res.action === 'plan_ready') {
                setSuccessMsg(res.message);
                navigate('/dashboard', { replace: true });
            } else if (res.action === 'setup') {
                navigate('/setup', { state: { ...res } });
            }

        } catch (e) {
            setError(e.message || "Failed to finalize project architecture.");
        }
        setLoad(false);
    };

    if (totalSteps === 0) return null;

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .step-content { animation: slideIn 0.4s ease-out; }
                .progress-dot { width: 8px; height: 8px; border-radius: 50%; transition: all 0.3s; }
                .progress-dot.active { background: #3fb950; transform: scale(1.3); box-shadow: 0 0 12px rgba(63, 185, 80, 0.5); }
                .progress-dot.pending { background: #30363d; }
                .progress-dot.done { background: #23863680; }
            `}</style>

            <div style={styles.card}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.mentorLogo}>
                        <BrainCircuit size={20} color="#3fb950" />
                    </div>
                    <div>
                        <div style={styles.mentorName}>ARCHITECT DISCOVERY</div>
                        <div style={styles.mentorStatus}>Project Initialization in progress...</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={styles.stepCounter}>STEP {currentStep + 1} OF {totalSteps}</div>
                        <div style={styles.progressLine}>
                            {questions.map((_, i) => (
                                <div key={i} className={`progress-dot ${i === currentStep ? 'active' : i < currentStep ? 'done' : 'pending'}`} />
                            ))}
                        </div>
                    </div>
                </div>

                <div style={styles.divider} />

                {/* Content */}
                <div className="step-content" key={currentStep}>
                    <div style={styles.messageBox}>
                        <Sparkles size={16} color="#f2cc60" style={{ flexShrink: 0 }} />
                        <div style={styles.messageText}>
                            {currentStep === 0 ? message : "Got it. Let's move to the next detail..."}
                        </div>
                    </div>

                    <h2 style={styles.questionText}>
                        {currentQuestion.text}
                    </h2>

                    <textarea
                        autoFocus
                        style={styles.textarea}
                        placeholder="Type your response here... (e.g. 'I know basic React', 'I want users to pay in USDT')"
                        value={answers[currentQuestion.id] || ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                        onKeyDown={e => e.ctrlKey && e.key === 'Enter' && handleNext()}
                    />

                    {error && (
                        <div style={styles.errorBox}>
                            ⚠ {error}
                        </div>
                    )}

                    <div style={styles.footer}>
                        <div style={{ fontSize: 11, color: '#484f58', fontFamily: 'monospace' }}>
                            Ctrl+Enter to advance
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            {currentStep > 0 && (
                                <button onClick={handleBack} style={styles.btnSecondary}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                            )}
                            <button 
                                onClick={handleNext} 
                                disabled={loading}
                                style={styles.btnPrimary}
                            >
                                {loading ? (
                                    <>Architecting... <Loader2 className="spin" size={16} /></>
                                ) : (
                                    <>{currentStep === totalSteps - 1 ? 'Finalize Project' : 'Next Question'} <ArrowRight size={16} /></>
                                )}
                            </button>
                        </div>
                    </div>
                    
                    {/* Just Start Option */}
                    {totalSteps > 0 && !loading && (
                      <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #21262d', paddingTop: 24 }}>
                        <button 
                          onClick={() => {
                            setAnswers(prev => ({ ...prev, [currentQuestion?.id]: "I'm not exactly sure about the specific details yet, I want to start building and learn as I go. Please use your best architectural judgment to set up a professional roadmap for me." }));
                            setTimeout(handleSubmit, 100);
                          }}
                          style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                        >
                          <Sparkles size={14} /> I'm not sure, just start with defaults & guide me
                        </button>
                      </div>
                    )}
                </div>
            </div>

            {/* Motivation Section */}
            <div style={styles.motivationCard}>
                <Rocket size={18} color="#a371f7" />
                <div style={{ fontSize: 13, color: '#8b949e', flex: 1 }}>
                    <strong>Architecture Locking:</strong> We are refining your vision to ensure a 100% executable roadmap with zero logic gaps.
                </div>
                <CheckCircle2 size={18} color="#3fb950" />
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: '#010409',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'var(--sans)',
        color: '#e6edf3'
    },
    card: {
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 20,
        width: '100%',
        maxWidth: 680,
        padding: '32px 40px',
        boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
        position: 'relative'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24
    },
    mentorLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'rgba(63, 185, 80, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    mentorName: { fontSize: 13, fontWeight: 900, letterSpacing: '0.05em', color: '#fff' },
    mentorStatus: { fontSize: 11, color: '#3fb950', fontWeight: 600 },
    stepCounter: { fontSize: 10, fontWeight: 800, color: '#8b949e', marginBottom: 8, textTransform: 'uppercase' },
    progressLine: { display: 'flex', gap: 6, justifyContent: 'flex-end' },
    divider: { height: 1, background: '#21262d', margin: '0 -40px 32px -40px' },
    messageBox: {
        background: 'rgba(242, 204, 96, 0.05)',
        border: '1px solid rgba(242, 204, 96, 0.15)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        marginBottom: 32
    },
    messageText: { fontSize: 13, color: '#f2cc60', lineHeight: 1.5, fontWeight: 500 },
    questionText: { fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 24, lineHeight: 1.2, letterSpacing: '-0.02em' },
    textarea: {
        width: '100%',
        background: '#010409',
        border: '1px solid #30363d',
        borderRadius: 12,
        padding: '20px',
        color: '#e6edf3',
        fontSize: 16,
        fontFamily: 'inherit',
        resize: 'none',
        minHeight: 140,
        outline: 'none',
        transition: 'border-color 0.2s',
        marginBottom: 24
    },
    errorBox: {
        background: 'rgba(248, 81, 73, 0.1)',
        border: '1px solid rgba(248, 81, 73, 0.4)',
        color: '#f85149',
        padding: '12px 16px',
        borderRadius: 8,
        fontSize: 12,
        marginBottom: 24
    },
    footer: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid #21262d',
        marginTop: 32,
        paddingTop: 24,
        background: 'transparent'
    },
    btnPrimary: {
        background: '#238636',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: 8,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'all 0.2s'
    },
    btnSecondary: {
        background: 'transparent',
        color: '#8b949e',
        border: '1px solid #30363d',
        padding: '12px 20px',
        borderRadius: 8,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer'
    },
    motivationCard: {
        marginTop: 32,
        width: '100%',
        maxWidth: 680,
        background: 'rgba(1, 4, 9, 0.5)',
        border: '1px solid #21262d',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16
    }
};
