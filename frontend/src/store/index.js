import { create } from 'zustand';
export const useStore = create((set, get) => ({
  userId:   localStorage.getItem('ab_uid')  || null,
  userName: localStorage.getItem('ab_uname')|| null,
  token:    localStorage.getItem('ab_token')|| null,
  role:     localStorage.getItem('ab_role') || null,
  avatar:   localStorage.getItem('ab_avatar')|| null,
  projectId: localStorage.getItem('ab_pid') || null,
  taskId:    localStorage.getItem('ab_tid') || null,
  chatLog:  [],

  setAuth: (user, token) => {
    localStorage.setItem('ab_uid',   user.id);
    localStorage.setItem('ab_uname', user.name);
    localStorage.setItem('ab_token', token);
    localStorage.setItem('ab_role',  user.role);
    if (user.avatar) localStorage.setItem('ab_avatar', user.avatar);
    
    set({ 
      userId: user.id, 
      userName: user.name, 
      token: token, 
      role: user.role, 
      avatar: user.avatar || null 
    });
  },

  setUser: (id, name) => {
    localStorage.setItem('ab_uid',   id);
    localStorage.setItem('ab_uname', name);
    set({ userId: id, userName: name });
  },

  logout: () => {
    localStorage.removeItem('ab_uid');
    localStorage.removeItem('ab_uname');
    localStorage.removeItem('ab_token');
    localStorage.removeItem('ab_role');
    localStorage.removeItem('ab_avatar');
    localStorage.removeItem('ab_pid');
    localStorage.removeItem('ab_tid');
    set({ userId: null, userName: null, token: null, role: null, avatar: null, project: null, milestones: [], currentTask: null, projectId: null, taskId: null });
  },

  project:     null,
  milestones:  [],
  tempMilestones: null,
  currentTask: null,
  qaReview:    null,
  automations: [],
  successMsg:  '',
  isRehydrating: !!localStorage.getItem('ab_token'),
  setRehydrating: (r) => set({ isRehydrating: r }),


  setProject:     p  => {
    if (p?.id) localStorage.setItem('ab_pid', p.id);
    else localStorage.removeItem('ab_pid');
    set({ project: p, projectId: p?.id || null });
  },
  setMilestones:  ms => set({ milestones: ms }),
  setCurrentTask: t  => {
    if (t?.id) localStorage.setItem('ab_tid', t.id);
    else localStorage.removeItem('ab_tid');
    set({ currentTask: t, taskId: t?.id || null, qaReview: null });
  },
  setQAReview:    r  => set({ qaReview: r }),
  clearQA:        () => set({ qaReview: null }),
  addAutomations: items => set(s => ({ automations: [...s.automations, ...items] })),
  setSuccessMsg:  msg  => { set({ successMsg: msg }); setTimeout(() => set({ successMsg: '' }), 5000); },
  addChatMessage: (msg) => set(s => ({ chatLog: [...s.chatLog, msg] })),
  setChatLog:     (log) => set({ chatLog: log }),
  applyResponse: (res) => {
    const u = { isRehydrating: false };
    if (res.project) {
        u.project = res.project;
        u.projectId = res.project.id;
        localStorage.setItem('ab_pid', res.project.id);
    }
    if (res.milestones) {
        if (res.action === 'milestones_generated') {
          u.tempMilestones = res.milestones;
        } else {
          u.milestones = res.milestones;
          u.tempMilestones = null;
        }
    }
    if (res.task !== undefined || res.next_task !== undefined) {
        const t = res.task || res.next_task || null;
        u.currentTask = t;
        u.taskId = t ? t.id : null;
        if (t) localStorage.setItem('ab_tid', t.id);
        else localStorage.removeItem('ab_tid');
    } else if (res.action === 'resume' || res.action === 'plan_ready') {
        if (!res.task) {
          u.currentTask = null;
          u.taskId = null;
          localStorage.removeItem('ab_tid');
        }
    }
    if (res.qa_review)  u.qaReview   = res.qa_review;
    if (res.automations?.length) u.automations = [...get().automations, ...res.automations];
    if (res.conversation) {
        u.chatLog = res.conversation.map(c => ({ role: c.role, content: c.content }));
    }
    set(u);
  },

  reset: () => {
    localStorage.removeItem('ab_pid');
    localStorage.removeItem('ab_tid');
    set({ project: null, milestones: [], currentTask: null, qaReview: null, automations: [], successMsg: '', isRehydrating: false, projectId: null, taskId: null });
  },
}));
