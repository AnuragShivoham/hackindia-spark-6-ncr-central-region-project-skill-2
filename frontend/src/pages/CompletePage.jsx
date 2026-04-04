import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';

export default function CompletePage() {
  const navigate = useNavigate();
  const { project, reset } = useStore();
  return (
    <div className="cmplt">
      <div className="fade-in" style={{textAlign:'center'}}>
        <div className="cmplt-icon">✓</div>
        <h1 style={{fontFamily:'var(--display)',fontSize:26,fontWeight:800,color:'var(--green)',marginBottom:8}}>
          Project Complete
        </h1>
        <p style={{color:'var(--tx-2)',fontSize:14,marginBottom:6}}>{project?.title}</p>
        <p style={{color:'var(--tx-m)',fontSize:11}}>All milestones passed · {project?.total_tasks} tasks completed</p>
        <button className="btn btn-g" style={{marginTop:28}} onClick={()=>{ reset(); navigate('/'); }}>
          Start New Project
        </button>
      </div>
    </div>
  );
}
