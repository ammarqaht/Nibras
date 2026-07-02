'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = { id: number; membershipNo: number; studentName: string; stage: string; grade: string; registrationStatus: string; paymentStatus?: string };
type SupervisorUser = { id: number; name: string; email: string };
type Task = {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  dueDate: string;
  createdAt: string;
  track: string | null;
  isActive: boolean;
  submissionMethod: string | null;
  timeLimitHours: number | null;
  assignedAdmins: string[];
  imageUrl: string | null;
  resourceLink: string | null;
  visibility: string;
  visibleToIds: number[];
};
type Submission = {
  id: string;
  registrationId: number;
  taskId: string;
  fileUrl: string;
  status: string;
  grade: number | null;
  feedback: string | null;
  selectedAdminId: string | null;
  startedAt: string | null;
  submittedAt: string;
  studentName: string;
  taskTitle: string;
  taskMaxPoints: number;
  taskTrack: string | null;
  taskAssignedAdmins: string[];
};

/* Client-side image compression */
function compressImage(file: File, maxDim = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function statusLabel(status: string) {
  if (status === 'approved') return 'مقبولة ✓';
  if (status === 'rejected') return 'مردودة ✗';
  return 'بانتظار المراجعة';
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (status === 'rejected') return 'bg-nred-50 text-nred-700 border border-nred-200';
  return 'bg-brand-50 text-brand-700 border border-brand-200';
}

function getTrackPillClass(track: string | null) {
  if (track === 'الثقافي' || track === 'ثقافي') return 'bg-yellow-50 text-yellow-700 border border-yellow-200/60';
  if (track === 'مسار تقني' || track === 'تقني') return 'bg-ncyan-50 text-ncyan-700 border border-ncyan-200/60';
  if (track === 'الذاكرة الحديدية') return 'bg-purple-50 text-purple-700 border border-purple-200/60';
  if (track === 'الاجتماعي' || track === 'اجتماعي') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
  if (track === 'مسار إعلامي' || track === 'إعلامي') return 'bg-ink-100 text-ink-700 border border-ink-200';
  return 'bg-ink-50 text-ink-600 border border-ink-200';
}

export default function TasksPage() {
  const { user } = useSupervisor();
  const roles = useMemo(() => (user?.role || '').split(',').map(r => r.trim()), [user]);
  const isScientific = useMemo(() => roles.includes('scientific_supervisor'), [roles]);
  const [activeTab, setActiveTab] = useState<'submissions' | 'log' | 'add' | 'manage'>('manage');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'submissions' || tabParam === 'log' || tabParam === 'add' || tabParam === 'manage') {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Search/Filters states
  const [subSearch, setSubSearch] = useState('');
  const [subTaskFilter, setSubTaskFilter] = useState('');
  const [subAdminFilter, setSubAdminFilter] = useState('');

  const [logSearch, setLogSearch] = useState('');
  const [logTaskFilter, setLogTaskFilter] = useState('');
  const [logAdminFilter, setLogAdminFilter] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('');

  const [manageSearch, setManageSearch] = useState('');
  const [manageTrackFilter, setManageTrackFilter] = useState('');
  const [manageSortFilter, setManageSortFilter] = useState('default');

  // Modals states
  const [evalSub, setEvalSub] = useState<Submission | null>(null);
  const [evalPoints, setEvalPoints] = useState('');
  const [evalComment, setEvalComment] = useState('');
  const [evalBusy, setEvalBusy] = useState(false);

  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [scopeTask, setScopeTask] = useState<Task | null>(null);
  const [scopeSearch, setScopeSearch] = useState('');
  const [scopeSelected, setScopeSelected] = useState<number[]>([]);
  const [scopeBusy, setScopeBusy] = useState(false);

  const [statsTask, setStatsTask] = useState<Task | null>(null);
  const [statsSearch, setStatsSearch] = useState('');
  const [statsFilter, setStatsFilter] = useState<'all' | 'submitted' | 'missing'>('all');

  // Add task state
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addPoints, setAddPoints] = useState('10');
  const [addDeadline, setAddDeadline] = useState('');
  const [addMethod, setAddMethod] = useState('رفع ملف');
  const [addTimeLimit, setAddTimeLimit] = useState('');
  const [addResourceLink, setAddResourceLink] = useState('');
  const [addImage, setAddImage] = useState<string | null>(null);
  const [addAdmins, setAddAdmins] = useState<string[]>([]);
  const [addTrack, setAddTrack] = useState('عام');
  const [addBusy, setAddBusy] = useState(false);

  const editFileRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const [studentsRes, supervisorsRes, tasksRes, submissionsRes] = await Promise.all([
        fetch('/api/supervisor/students', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks/supervisors', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks', { cache: 'no-store' }),
        fetch('/api/supervisor/submissions', { cache: 'no-store' })
      ]);

      const studentsData = await studentsRes.json().catch(() => ({ students: [] }));
      const supervisorsData = await supervisorsRes.json().catch(() => ({ supervisors: [] }));
      const tasksData = await tasksRes.json().catch(() => ({ tasks: [] }));
      const submissionsData = await submissionsRes.json().catch(() => ({ submissions: [] }));

      setStudents(studentsData.students ?? []);
      setSupervisors(supervisorsData.supervisors ?? []);
      setTasks(tasksData.tasks ?? []);
      setSubmissions(submissionsData.submissions ?? []);
    } catch (err) {
      console.error('Failed to load data', err);
      pushToast('error', 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const pendingSubmissions = useMemo(() => submissions.filter(s => s.status === 'pending'), [submissions]);
  const logSubmissions = useMemo(() => submissions.filter(s => s.status !== 'pending'), [submissions]);

  const filteredPendingSubmissions = useMemo(() => {
    return pendingSubmissions.filter(s => {
      const matchQ = !subSearch.trim() || s.studentName.toLowerCase().includes(subSearch.trim().toLowerCase());
      const matchTask = !subTaskFilter || s.taskId === subTaskFilter;
      const matchAdmin = !subAdminFilter || 
        (subAdminFilter === '__all__' ? s.taskAssignedAdmins.length === 0 : s.taskAssignedAdmins.includes(subAdminFilter));
      return matchQ && matchTask && matchAdmin;
    });
  }, [pendingSubmissions, subSearch, subTaskFilter, subAdminFilter]);

  const filteredLogSubmissions = useMemo(() => {
    return logSubmissions.filter(s => {
      const matchQ = !logSearch.trim() || s.studentName.toLowerCase().includes(logSearch.trim().toLowerCase());
      const matchTask = !logTaskFilter || s.taskId === logTaskFilter;
      const matchStatus = !logStatusFilter || s.status === logStatusFilter;
      const matchAdmin = !logAdminFilter || 
        (logAdminFilter === '__all__' ? s.taskAssignedAdmins.length === 0 : s.taskAssignedAdmins.includes(logAdminFilter));
      return matchQ && matchTask && matchStatus && matchAdmin;
    });
  }, [logSubmissions, logSearch, logTaskFilter, logStatusFilter, logAdminFilter]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => {
      const matchQ = !manageSearch.trim() || t.title.toLowerCase().includes(manageSearch.trim().toLowerCase()) || t.description.toLowerCase().includes(manageSearch.trim().toLowerCase());
      const matchTrack = !manageTrackFilter || t.track === manageTrackFilter;
      return matchQ && matchTrack;
    });
    
    if (manageSortFilter === 'points') {
      result = result.sort((a, b) => b.maxPoints - a.maxPoints);
    } else if (manageSortFilter === 'newest') {
      result = result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (manageSortFilter === 'dueDate') {
      result = result.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
    }
    return result;
  }, [tasks, manageSearch, manageTrackFilter, manageSortFilter]);

  const uniqueTasksPending = useMemo(() => tasks.filter(t => new Set(pendingSubmissions.map(s => s.taskId)).has(t.id)), [tasks, pendingSubmissions]);
  const uniqueTasksLog = useMemo(() => tasks.filter(t => new Set(logSubmissions.map(s => s.taskId)).has(t.id)), [tasks, logSubmissions]);

  // General counts for stats
  const totalTasksCount = tasks.length;
  const activeTasksCount = tasks.filter(t => t.isActive).length;
  const disabledTasksCount = totalTasksCount - activeTasksCount;
  const pendingCount = pendingSubmissions.length;

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addDesc.trim() || !addDeadline) return pushToast('error', 'يرجى إدخال جميع الحقول الإلزامية');

    setAddBusy(true);
    try {
      const res = await fetch('/api/supervisor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDesc.trim(),
          maxPoints: parseInt(addPoints, 10),
          dueDate: addDeadline,
          submissionMethod: addMethod,
          timeLimitHours: addTimeLimit ? parseInt(addTimeLimit, 10) : null,
          assignedAdmins: addAdmins,
          track: addTrack.trim() || 'عام',
          imageUrl: addImage,
          resourceLink: addResourceLink.trim() || null,
          visibility: 'all',
          visibleToIds: [],
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المهمة');

      pushToast('success', 'تم نشر المهمة بنجاح ✓');
      setAddTitle(''); setAddDesc(''); setAddPoints('10'); setAddDeadline(''); setAddMethod('رفع ملف'); setAddTimeLimit(''); setAddResourceLink(''); setAddImage(null); setAddAdmins([]); setAddTrack('عام');
      await loadData();
      setActiveTab('manage');
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ في الشبكة');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleEvaluate(status: 'approved' | 'rejected') {
    if (!evalSub) return;
    const grade = parseInt(evalPoints, 10);
    if (status === 'approved' && (isNaN(grade) || grade < 0 || grade > evalSub.taskMaxPoints)) {
      return pushToast('error', `يجب أن تكون الدرجة بين 0 و ${evalSub.taskMaxPoints}`);
    }

    setEvalBusy(true);
    try {
      const res = await fetch(`/api/supervisor/submissions/${evalSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          grade: status === 'approved' ? grade : 0,
          feedback: evalComment.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التقييم');

      pushToast('success', status === 'approved' ? 'تم قبول واعتماد التقييم ✓' : 'تم رد المهمة للطلب ✗');
      setEvalSub(null); setEvalPoints(''); setEvalComment('');
      loadData();
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ أثناء التقييم');
    } finally {
      setEvalBusy(false);
    }
  }

  async function toggleTaskActive(task: Task) {
    try {
      const res = await fetch(`/api/supervisor/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !task.isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تغيير الحالة');
      pushToast('info', task.isActive ? 'تم تعطيل المهمة مؤقتاً' : 'تم تفعيل المهمة ونشرها');
      loadData();
    } catch (err: any) {
      pushToast('error', err.message);
    }
  }

  async function handleTaskDelete(id: string, title: string) {
    if (!confirm(`هل أنت متأكد من حذف المهمة "${title}" نهائياً؟ سيتم حذف كافة تسليمات الطلاب المرتبطة بها!`)) return;
    try {
      const res = await fetch(`/api/supervisor/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل حذف المهمة');
      pushToast('info', 'تم حذف المهمة نهائياً');
      loadData();
    } catch (err: any) {
      pushToast('error', err.message);
    }
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/supervisor/tasks/${editTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTask.title.trim(),
          description: editTask.description.trim(),
          maxPoints: editTask.maxPoints,
          dueDate: editTask.dueDate,
          track: editTask.track?.trim() || 'عام',
          submissionMethod: editTask.submissionMethod,
          timeLimitHours: editTask.timeLimitHours,
          assignedAdmins: editTask.assignedAdmins,
          imageUrl: editTask.imageUrl,
          resourceLink: editTask.resourceLink,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث المهمة');
      pushToast('success', 'تم حفظ التعديلات بنجاح ✓');
      setEditTask(null);
      loadData();
    } catch (err: any) {
      pushToast('error', err.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function handleScopeConfirm() {
    if (!scopeTask) return;
    setScopeBusy(true);
    try {
      const res = await fetch(`/api/supervisor/tasks/${scopeTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: scopeTask.visibility,
          visibleToIds: scopeTask.visibility === 'restricted' ? scopeSelected : [],
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحديث النطاق');
      pushToast('success', 'تم تحديث نطاق المهمة بنجاح ✓');
      setScopeTask(null);
      loadData();
    } catch (err: any) {
      pushToast('error', err.message);
    } finally {
      setScopeBusy(false);
    }
  }

  // --- Inline Points Editor ---
  const [inlineEditSub, setInlineEditSub] = useState<string | null>(null);
  const [inlinePoints, setInlinePoints] = useState('');
  const [inlineBusy, setInlineBusy] = useState(false);

  async function saveInlinePoints(sub: Submission) {
    const val = parseInt(inlinePoints, 10);
    if (isNaN(val) || val < 0 || val > sub.taskMaxPoints) {
      return pushToast('error', `يجب أن تكون الدرجة بين 0 و ${sub.taskMaxPoints}`);
    }
    setInlineBusy(true);
    try {
      const res = await fetch(`/api/supervisor/submissions/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: val })
      });
      if (!res.ok) throw new Error('Failed to update');
      pushToast('success', 'تم تعديل الدرجة بنجاح ✓');
      setInlineEditSub(null);
      loadData();
    } catch {
      pushToast('error', 'فشل تعديل الدرجة');
    } finally {
      setInlineBusy(false);
    }
  }

  // Statistics modal helper
  const statsStudentList = useMemo(() => {
    if (!statsTask) return [];
    const activeStudents = students.filter(s => s.registrationStatus === 'approved' || s.paymentStatus === 'exempted');
    const scopedStudents = statsTask.visibility === 'restricted' ? activeStudents.filter(s => statsTask.visibleToIds.includes(s.id)) : activeStudents;
    const taskSubmissionsMap = new Map(submissions.filter(s => s.taskId === statsTask.id).map(s => [s.registrationId, s]));

    const list = scopedStudents.map(student => {
      const sub = taskSubmissionsMap.get(student.id);
      return { ...student, submitted: !!sub, submission: sub || null };
    });

    let filtered = list;
    if (statsSearch.trim()) filtered = list.filter(item => item.studentName.toLowerCase().includes(statsSearch.trim().toLowerCase()));
    if (statsFilter === 'submitted') filtered = filtered.filter(item => item.submitted);
    else if (statsFilter === 'missing') filtered = filtered.filter(item => !item.submitted);
    return filtered;
  }, [statsTask, students, submissions, statsSearch, statsFilter]);

  const statsCounts = useMemo(() => {
    if (!statsTask) return { total: 0, submitted: 0, missing: 0, pending: 0 };
    const activeStudents = students.filter(s => s.registrationStatus === 'approved' || s.paymentStatus === 'exempted');
    const scopedStudents = statsTask.visibility === 'restricted' ? activeStudents.filter(s => statsTask.visibleToIds.includes(s.id)) : activeStudents;
    const taskSubmissions = submissions.filter(s => s.taskId === statsTask.id);
    const submittedIds = new Set(taskSubmissions.map(s => s.registrationId));
    const total = scopedStudents.length;
    const submitted = scopedStudents.filter(s => submittedIds.has(s.id)).length;
    const pending = taskSubmissions.filter(s => s.status === 'pending').length;
    const missing = total - submitted;
    return { total, submitted, missing, pending };
  }, [statsTask, students, submissions]);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file);
      if (isEdit && editTask) setEditTask({ ...editTask, imageUrl: base64 });
      else setAddImage(base64);
      pushToast('info', 'تم تجهيز الصورة بنجاح ✓');
    } catch {
      pushToast('error', 'تعذر معالجة الصورة');
    }
  }

  const toggleAdminChip = (id: string, isEdit = false) => {
    if (isEdit && editTask) {
      const current = editTask.assignedAdmins;
      setEditTask({ ...editTask, assignedAdmins: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
    } else {
      setAddAdmins(addAdmins.includes(id) ? addAdmins.filter(x => x !== id) : [...addAdmins, id]);
    }
  };

  return (
    <div dir="rtl" className="w-full relative">
      
      {/* 1. TOPBAR TAB SELECTOR */}
      <div className="bg-white border border-ink-200 rounded-[1.2rem] p-2 mb-8 flex flex-col md:flex-row gap-2 shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'manage' ? 'bg-brand text-white shadow-brand' : 'text-ink-600 hover:bg-cream-100 hover:text-ink-900'
          }`}
        >
          <span>إدارة المهام</span>
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'submissions' ? 'bg-brand text-white shadow-brand' : 'text-ink-600 hover:bg-cream-100 hover:text-ink-900'
          }`}
        >
          <span>المهام المستلمة</span>
          {pendingCount > 0 && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${activeTab === 'submissions' ? 'bg-white text-brand' : 'bg-brand-50 border border-brand-200 text-brand-600'}`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            activeTab === 'log' ? 'bg-brand text-white shadow-brand' : 'text-ink-600 hover:bg-cream-100 hover:text-ink-900'
          }`}
        >
          <span>سجل التقييمات</span>
        </button>
        {isScientific && (
          <button
            onClick={() => setActiveTab('add')}
            className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all shrink-0 md:mr-auto ${
              activeTab === 'add' ? 'bg-brand text-white shadow-brand' : 'text-ink-600 hover:bg-cream-100 hover:text-ink-900'
            }`}
          >
            <span>إضافة مهمة</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل البيانات…</div>
      ) : (
        <>
          {/* TAB 1: MANAGE TASKS */}
          {activeTab === 'manage' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-ncyan-50 flex items-center justify-center text-ncyan-600 text-2xl border border-ncyan-100 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </div>
                  <div>
                    <h1 className="text-[1.75rem] font-bold text-ink-900">إدارة المهام</h1>
                    <p className="text-[0.9rem] text-ink-500 mt-1">استعرض وعدّل وحذف جميع المهام المنشورة على المنصة.</p>
                  </div>
                </div>
                {isScientific && (
                  <button onClick={() => setActiveTab('add')} className="btn bg-ink-900 text-white hover:bg-ink-800 rounded-xl px-5 py-3 font-bold shadow-soft">
                    + إضافة مهمة جديدة
                  </button>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                <div className="card p-6 flex flex-col items-center justify-center text-center shadow-soft">
                  <div className="text-4xl font-extrabold text-ncyan-600">{totalTasksCount}</div>
                  <div className="text-[0.9rem] font-bold text-ink-500 mt-2">إجمالي المهام</div>
                </div>
                <div className="card p-6 flex flex-col items-center justify-center text-center shadow-soft">
                  <div className="text-4xl font-extrabold text-emerald-600">{activeTasksCount}</div>
                  <div className="text-[0.9rem] font-bold text-ink-500 mt-2">مهام مُفعّلة</div>
                </div>
                <div className="card p-6 flex flex-col items-center justify-center text-center shadow-soft">
                  <div className="text-4xl font-extrabold text-brand-600">{pendingCount}</div>
                  <div className="text-[0.9rem] font-bold text-ink-500 mt-2">بانتظار التقييم</div>
                </div>
                <div className="card p-6 flex flex-col items-center justify-center text-center shadow-soft">
                  <div className="text-4xl font-extrabold text-nred-600">{disabledTasksCount}</div>
                  <div className="text-[0.9rem] font-bold text-ink-500 mt-2">مهام معطلة</div>
                </div>
              </div>

              {/* Filters Box */}
              <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 border border-ink-150 shadow-sm mt-2">
                <div className="relative flex-1 w-full">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="ابحث باسم المهمة..."
                    className="field pl-4 pr-11 py-2.5 text-[0.9rem] w-full rounded-xl bg-ink-50/30 border-transparent focus:border-ncyan-600 focus:bg-white"
                    value={manageSearch}
                    onChange={e => setManageSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-48 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={manageTrackFilter} onChange={e => setManageTrackFilter(e.target.value)}>
                    <option value="">كل المسارات</option>
                    <option value="عام">العامة</option>
                    <option value="الثقافي">الثقافي</option>
                    <option value="مسار تقني">مسار تقني</option>
                    <option value="الذاكرة الحديدية">الذاكرة الحديدية</option>
                    <option value="الاجتماعي">الاجتماعي</option>
                    <option value="مسار إعلامي">مسار إعلامي</option>
                  </select>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-48 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={manageSortFilter} onChange={e => setManageSortFilter(e.target.value)}>
                    <option value="default">الترتيب الافتراضي</option>
                    <option value="newest">الأحدث أولاً</option>
                    <option value="points">الأكثر نقاطاً</option>
                    <option value="dueDate">حسب الاستحقاق</option>
                  </select>
                </div>
              </div>

              {/* Tasks List */}
              <div className="card p-0 overflow-hidden border border-ink-150 shadow-soft">
                {filteredTasks.length === 0 ? (
                  <div className="p-16 text-center text-ink-400">لا توجد مهام مطابقة للبحث.</div>
                ) : (
                  <div className="overflow-x-auto scroll-soft">
                    <table className="w-full text-right">
                      <thead className="bg-ink-50/60 border-b border-ink-150 text-ink-500 text-[0.85rem]">
                        <tr>
                          <th className="font-bold py-4 px-5">المهمة</th>
                          <th className="font-bold py-4 px-5">المسار</th>
                          <th className="font-bold py-4 px-5 text-center">النقاط</th>
                          <th className="font-bold py-4 px-5">الموعد</th>
                          <th className="font-bold py-4 px-5 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTasks.map(task => (
                          <tr key={task.id} className={`border-b border-ink-150 last:border-0 hover:bg-cream-100/50 transition-colors ${!task.isActive ? 'opacity-60 bg-ink-50/20' : ''}`}>
                            <td className="py-4 px-5 max-w-[280px]">
                              <div className="font-bold text-ink-900 mb-1.5 text-[0.95rem]">{task.title}</div>
                              <div className="text-[0.8rem] text-ink-400 line-clamp-1 leading-relaxed">{task.description}</div>
                            </td>
                            <td className="py-4 px-5">
                              <span className={`px-3 py-1 rounded-full text-[0.75rem] font-bold ${getTrackPillClass(task.track)}`}>
                                {task.track || 'عام'}
                              </span>
                            </td>
                            <td className="py-4 px-5">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-1.5 font-extrabold text-ink-900 text-[0.95rem]">
                                  <span>{task.maxPoints}</span>
                                  <span className="text-brand-500 text-lg">🎯</span>
                                </div>
                                {task.timeLimitHours && (
                                  <span className="text-ink-400 text-[0.75rem] font-bold bg-ink-50 px-2 py-0.5 rounded-md border border-ink-150">⏳ مهلة {task.timeLimitHours}س</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-5 font-mono text-[0.8rem] font-bold text-ink-500">
                              {task.dueDate.split('T')[0]}
                            </td>
                            <td className="py-4 px-5">
                              <div className="flex gap-2 justify-center flex-wrap">
                                {isScientific && (
                                  <>
                                    <button
                                      className="border border-ncyan-600/30 text-ncyan-700 bg-ncyan-50/60 hover:bg-ncyan-100/60 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                      onClick={() => setEditTask(task)}
                                    >
                                      تعديل
                                    </button>
                                    <button
                                      className={`border px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${task.isActive ? 'border-brand/40 text-brand-700 bg-brand-50/60 hover:bg-brand-100/60' : 'border-emerald-600/30 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/60'}`}
                                      onClick={() => toggleTaskActive(task)}
                                    >
                                      {task.isActive ? 'تعطيل' : 'تفعيل'}
                                    </button>
                                    <button
                                      className="border border-purple-500/30 text-purple-700 bg-purple-50/60 hover:bg-purple-100/60 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                      onClick={() => { setScopeTask(task); setScopeSelected(task.visibleToIds || []); setScopeSearch(''); }}
                                    >
                                      النطاق
                                    </button>
                                  </>
                                )}
                                <button
                                  className="border border-nblue-400/30 text-nblue-700 bg-nblue-50/60 hover:bg-nblue-100/60 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  onClick={() => { setStatsTask(task); setStatsSearch(''); setStatsFilter('all'); }}
                                >
                                  تسليمات
                                </button>
                                {isScientific && (
                                  <button
                                    className="border border-nred-400/30 text-nred-700 bg-nred-50/60 hover:bg-nred-100/60 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                    onClick={() => handleTaskDelete(task.id, task.title)}
                                  >
                                    حذف
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUBMISSIONS */}
          {activeTab === 'submissions' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 text-2xl border border-brand-100 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-[1.75rem] font-bold text-ink-900">مراجعة التسليمات</h1>
                    </div>
                    <p className="text-[0.9rem] text-ink-500 mt-1">اعتمد أو ارفض تسليمات الطلاب وامنح النقاط المناسبة.</p>
                  </div>
                </div>
                {pendingCount > 0 && (
                  <div className="bg-brand-50 border border-brand-200 text-brand-700 rounded-full px-5 py-2 text-[0.9rem] font-bold shadow-sm">
                    {pendingCount} تسليم بانتظار المراجعة
                  </div>
                )}
              </div>

              {pendingSubmissions.length > 0 && (
                <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 border border-ink-150 shadow-sm">
                  <div className="relative flex-1 w-full">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input type="text" className="field pl-4 pr-11 py-2.5 text-[0.9rem] w-full rounded-xl bg-ink-50/30 border-transparent focus:bg-white focus:border-brand" placeholder="ابحث باسم الطالب..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
                  </div>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-48 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={subTaskFilter} onChange={e => setSubTaskFilter(e.target.value)}>
                    <option value="">كل المهام</option>
                    {uniqueTasksPending.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-48 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={subAdminFilter} onChange={e => setSubAdminFilter(e.target.value)}>
                    <option value="">كل المشرفين</option>
                    <option value="__all__">جميع المشرفين</option>
                    {supervisors.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </select>
                  <button className="bg-ink-100 hover:bg-ink-200 text-ink-700 py-2.5 px-6 text-[0.9rem] font-bold rounded-xl shrink-0 transition-colors" onClick={() => { setSubSearch(''); setSubTaskFilter(''); setSubAdminFilter(''); }}>
                    مسح
                  </button>
                </div>
              )}

              {filteredPendingSubmissions.length === 0 ? (
                <div className="card text-center p-20 border-ink-150 shadow-soft">
                  <div className="text-5xl mb-4">🎉</div>
                  <h3 className="font-extrabold text-xl text-ink-900 mb-2">لا توجد تسليمات معلقة</h3>
                  <p className="text-[0.95rem] text-ink-500">لقد تم تقييم جميع تسليمات الطلاب بنجاح.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="text-sm font-bold text-ink-700 flex items-center gap-2 px-1">
                    بانتظار المراجعة ({filteredPendingSubmissions.length})
                  </div>
                  {filteredPendingSubmissions.map(sub => (
                    <SubmissionCard key={sub.id} sub={sub} onEvaluate={setEvalSub} supervisors={supervisors} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOG */}
          {activeTab === 'log' && (
            <div className="space-y-6 fade-in">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 text-2xl border border-purple-100 shadow-sm">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline><path d="M9 13l2 2 4-4"></path></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-[1.75rem] font-bold text-ink-900">سجل التقييمات السابقة</h1>
                    </div>
                    <p className="text-[0.9rem] text-ink-500 mt-1">سجل كامل لجميع التسليمات التي تم قبولها أو ردها.</p>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 text-purple-700 rounded-full px-5 py-2 text-[0.9rem] font-bold shadow-sm">
                  {logSubmissions.length} تقييم
                </div>
              </div>

              {logSubmissions.length > 0 && (
                <div className="bg-white rounded-2xl p-4 flex flex-col md:flex-row items-center gap-3 border border-ink-150 shadow-sm flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input type="text" className="field pl-4 pr-11 py-2.5 text-[0.9rem] w-full rounded-xl bg-ink-50/30 border-transparent focus:bg-white focus:border-purple-400" placeholder="ابحث باسم الطالب..." value={logSearch} onChange={e => setLogSearch(e.target.value)} />
                  </div>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-40 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={logTaskFilter} onChange={e => setLogTaskFilter(e.target.value)}>
                    <option value="">كل المهام</option>
                    {uniqueTasksLog.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-40 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={logAdminFilter} onChange={e => setLogAdminFilter(e.target.value)}>
                    <option value="">كل المشرفين</option>
                    <option value="__all__">جميع المشرفين</option>
                    {supervisors.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                  </select>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-36 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={logStatusFilter} onChange={e => setLogStatusFilter(e.target.value)}>
                    <option value="">كل الحالات</option>
                    <option value="approved">مقبولة</option>
                    <option value="rejected">مردودة</option>
                  </select>
                  <button className="bg-ink-100 hover:bg-ink-200 text-ink-700 py-2.5 px-6 text-[0.9rem] font-bold rounded-xl shrink-0 transition-colors" onClick={() => { setLogSearch(''); setLogTaskFilter(''); setLogAdminFilter(''); setLogStatusFilter(''); }}>
                    مسح
                  </button>
                </div>
              )}

              {filteredLogSubmissions.length === 0 ? (
                <div className="card text-center p-20 border-ink-150 shadow-soft">
                  <div className="text-4xl text-ink-300 mb-4">🗂️</div>
                  <h3 className="font-extrabold text-xl text-ink-900">لا توجد تقييمات مسجلة بعد.</h3>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredLogSubmissions.map(sub => (
                    <SubmissionCard
                      key={sub.id} sub={sub} supervisors={supervisors} isLog
                      inlineEditSub={inlineEditSub} inlinePoints={inlinePoints}
                      setInlineEditSub={setInlineEditSub} setInlinePoints={setInlinePoints}
                      saveInlinePoints={saveInlinePoints} inlineBusy={inlineBusy}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ADD TASK */}
          {activeTab === 'add' && isScientific && (
            <div className="max-w-4xl mx-auto fade-in space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-nblue-50 flex items-center justify-center text-nblue-600 text-2xl border border-nblue-100 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                </div>
                <div>
                  <h1 className="text-[1.75rem] font-bold text-ink-900 mb-1">إضافة مهمة جديدة</h1>
                  <p className="text-[0.9rem] text-ink-500">قم بنشر المهام والأنشطة لجميع الطلاب أو تحديد فئة منهم.</p>
                </div>
              </div>

              <form onSubmit={handleAddTask} className="bg-white rounded-2xl p-6 md:p-8 space-y-6 border border-ink-150 shadow-soft" autoComplete="off">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="label mb-1.5 font-bold text-ink-800">عنوان المهمة <span className="req">*</span></label>
                    <input type="text" className="field py-3 rounded-xl bg-ink-50/20" required placeholder="مثال: حفظ سورة الملك..." value={addTitle} onChange={e => setAddTitle(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label mb-1.5 font-bold text-ink-800">وصف وتفاصيل المهمة <span className="req">*</span></label>
                    <textarea className="field py-3 rounded-xl bg-ink-50/20" required rows={4} placeholder="اكتب تفاصيل وشروط المهمة بالتفصيل للطلاب..." value={addDesc} onChange={e => setAddDesc(e.target.value)} />
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">المسار التدريبي <span className="req">*</span></label>
                    <select className="field py-3 rounded-xl bg-ink-50/20" required value={addTrack} onChange={e => setAddTrack(e.target.value)}>
                      <option value="عام">عام</option>
                      <option value="الثقافي">الثقافي</option>
                      <option value="مسار تقني">مسار تقني</option>
                      <option value="الذاكرة الحديدية">الذاكرة الحديدية</option>
                      <option value="الاجتماعي">الاجتماعي</option>
                      <option value="مسار إعلامي">مسار إعلامي</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">تاريخ الاستحقاق <span className="req">*</span></label>
                    <input type="date" className="field py-3 rounded-xl bg-ink-50/20 font-mono" required value={addDeadline} onChange={e => setAddDeadline(e.target.value)} />
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">نقاط الإنجاز (🎯) <span className="req">*</span></label>
                    <input type="number" className="field py-3 rounded-xl bg-ink-50/20 text-center font-extrabold text-brand-600 text-lg w-full" required min={1} value={addPoints} onChange={e => setAddPoints(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">طريقة التسليم <span className="req">*</span></label>
                    <select className="field py-3 rounded-xl bg-ink-50/20" value={addMethod} onChange={e => setAddMethod(e.target.value)}>
                      <option value="رفع ملف">رفع ملف (صورة / مستند / فيديو)</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">مهلة الإنجاز (اختياري)</label>
                    <input type="number" min={1} placeholder="مثال: 2 (ساعتين)" className="field py-3 rounded-xl bg-ink-50/20 font-mono" value={addTimeLimit} onChange={e => setAddTimeLimit(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>

                <div className="pt-6 border-t border-ink-150">
                  <label className="label mb-3 font-bold text-ink-800">صورة توضيحية للمهمة (اختياري)</label>
                  <div onClick={() => addFileRef.current?.click()} className="border-2 border-dashed border-ink-200 bg-ink-50/30 hover:bg-cream-100 rounded-2xl p-8 text-center cursor-pointer transition-colors">
                    <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, false)} />
                    {addImage ? (
                      <div className="space-y-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={addImage} alt="Preview" className="max-h-48 mx-auto rounded-xl shadow-sm border border-ink-150" />
                        <button type="button" className="btn btn-secondary text-sm font-bold bg-white" onClick={(e) => { e.stopPropagation(); setAddImage(null); }}>إزالة الصورة</button>
                      </div>
                    ) : (
                      <div className="text-ink-500 text-[0.95rem] flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-ink-300 border border-ink-150">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                        <span className="font-medium">اضغط لاختيار صورة من جهازك للمهمة</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label mb-1.5 font-bold text-ink-800">رابط مرجعي خارجي (اختياري)</label>
                  <input type="url" className="field py-3 rounded-xl bg-ink-50/20" placeholder="https://example.com/resource" value={addResourceLink} onChange={e => setAddResourceLink(e.target.value)} />
                </div>

                <div className="bg-cream-50 p-5 rounded-2xl border border-ink-150">
                  <label className="label font-bold text-ink-800 text-base">المشرف المسؤول عن التقييم</label>
                  <p className="text-[0.85rem] text-ink-500 mb-4">اختر مشرفاً واحداً أو أكثر. عدم التحديد يعني أن جميع المشرفين يستطيعون التقييم.</p>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={() => setAddAdmins([])} className={`choice text-xs font-bold py-2 px-4 rounded-xl ${addAdmins.length === 0 ? 'is-active' : ''}`}>جميع المشرفين</button>
                    {supervisors.map(s => (
                      <button key={s.id} type="button" onClick={() => toggleAdminChip(String(s.id), false)} className={`choice text-xs font-bold py-2 px-4 rounded-xl ${addAdmins.includes(String(s.id)) ? 'is-active' : ''}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={addBusy} className="btn bg-brand-500 hover:bg-brand-600 text-white w-full py-4 rounded-xl font-bold text-[1.05rem] shadow-brand transition-all">
                    {addBusy ? 'جارٍ نشر المهمة…' : 'نشر المهمة والتحدي للطلاب 🚀'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: EVALUATE SUBMISSION */}
      {evalSub && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEvalSub(null)}>
          <div className="modal-panel w-full max-w-lg shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl">
              <h3 className="text-xl font-extrabold text-ink-900">مراجعة وتقييم المهمة</h3>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors" onClick={() => setEvalSub(null)}>×</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 font-extrabold flex items-center justify-center text-2xl shrink-0 border border-emerald-100 shadow-sm">
                  {evalSub.studentName?.charAt(0) || 'ط'}
                </div>
                <div>
                  <div className="font-extrabold text-ink-900 text-lg mb-0.5">{evalSub.studentName}</div>
                  <div className="text-[0.95rem] font-bold text-brand-600">{evalSub.taskTitle}</div>
                </div>
              </div>

              {evalSub.fileUrl && (
                <div className="bg-cream-100/60 p-5 rounded-2xl border border-ink-150">
                  <div className="text-[0.85rem] text-ink-500 font-bold mb-3">محتوى التسليم المرفق:</div>
                  {evalSub.fileUrl.startsWith('data:image') || evalSub.fileUrl.startsWith('http') && evalSub.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evalSub.fileUrl} alt="إثبات التسليم" className="max-h-64 rounded-xl border border-ink-200 mx-auto shadow-sm" />
                  ) : evalSub.fileUrl === 'admin://manual-mark' ? (
                    <div className="text-[0.95rem] text-ink-700 font-medium italic text-center py-4 bg-white rounded-xl border border-ink-150">إقرار إنجاز يدوي من المشرف</div>
                  ) : (
                    <a href={evalSub.fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-white hover:bg-brand-500 hover:border-brand-500 text-[0.95rem] font-bold block text-center py-4 bg-white rounded-xl border border-ink-200 transition-all shadow-sm">
                      📄 فتح المستند المرفق في نافذة جديدة
                    </a>
                  )}
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                <label className="label font-bold text-ink-900 text-[0.95rem] mb-3">النقاط الممنوحة (🎯) (الحد الأقصى: {evalSub.taskMaxPoints})</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <input type="number" min={0} max={evalSub.taskMaxPoints} className="field w-28 text-center font-extrabold text-2xl py-3 text-brand-600 border-brand-200 bg-brand-50/30 rounded-xl" value={evalPoints === '' ? evalSub.taskMaxPoints : evalPoints} onChange={e => setEvalPoints(e.target.value.replace(/\D/g, ''))} />
                  <div className="flex-1 flex gap-2">
                    <button type="button" onClick={() => setEvalPoints(String(evalSub.taskMaxPoints))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">كامل</button>
                    <button type="button" onClick={() => setEvalPoints(String(Math.round(evalSub.taskMaxPoints * 0.75)))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">75%</button>
                    <button type="button" onClick={() => setEvalPoints(String(Math.round(evalSub.taskMaxPoints * 0.5)))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">50%</button>
                    <button type="button" onClick={() => setEvalPoints('0')} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">صفر</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label font-bold text-ink-800 mb-2">تعليق أو توجيه للطالب (اختياري)</label>
                <textarea className="field py-3 rounded-xl bg-ink-50/30" rows={2} placeholder="مثال: ممتاز، استمر في هذا التميز!" value={evalComment} onChange={e => setEvalComment(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-6 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl">
              <button onClick={() => handleEvaluate('rejected')} disabled={evalBusy} className="btn bg-white text-nred-600 border border-nred-200 hover:bg-nred-50 transition-colors text-[0.95rem] font-bold rounded-xl py-3 px-6">
                رد المهمة للطلب (رفض)
              </button>
              <button onClick={() => handleEvaluate('approved')} disabled={evalBusy} className="btn bg-emerald-600 hover:bg-emerald-700 border-transparent text-white text-[0.95rem] font-bold shadow-soft rounded-xl py-3 px-8">
                {evalBusy ? 'جارٍ الحفظ…' : 'اعتماد وقبول التسليم ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT TASK */}
      {editTask && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEditTask(null)}>
          <div className="modal-panel w-full max-w-2xl shadow-elevated" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateTask} autoComplete="off">
              <div className="flex items-center justify-between p-6 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl">
                <h3 className="text-xl font-extrabold text-ink-900">تعديل بيانات المهمة</h3>
                <button type="button" className="text-3xl text-ink-400 hover:text-ink-900" onClick={() => setEditTask(null)}>×</button>
              </div>
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto scroll-soft">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="label font-bold text-ink-800 mb-1.5">عنوان المهمة</label>
                    <input type="text" className="field py-3 rounded-xl bg-ink-50/30" required value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label font-bold text-ink-800 mb-1.5">الوصف</label>
                    <textarea className="field py-3 rounded-xl bg-ink-50/30" required rows={3} value={editTask.description} onChange={e => setEditTask({ ...editTask, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">المسار التدريبي</label>
                    <select className="field py-3 rounded-xl bg-ink-50/30" required value={editTask.track || 'عام'} onChange={e => setEditTask({ ...editTask, track: e.target.value })}>
                      <option value="عام">عام</option>
                      <option value="الثقافي">الثقافي</option>
                      <option value="مسار تقني">مسار تقني</option>
                      <option value="الذاكرة الحديدية">الذاكرة الحديدية</option>
                      <option value="الاجتماعي">الاجتماعي</option>
                      <option value="مسار إعلامي">مسار إعلامي</option>
                    </select>
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">النقاط (🎯)</label>
                    <input type="number" className="field py-3 rounded-xl bg-ink-50/30 text-center font-extrabold text-brand-600 w-full" required min={1} value={editTask.maxPoints} onChange={e => setEditTask({ ...editTask, maxPoints: parseInt(e.target.value.replace(/\D/g, ''), 10) || 1 })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">تاريخ الاستحقاق</label>
                    <input type="date" className="field py-3 rounded-xl bg-ink-50/30 font-mono" required value={editTask.dueDate.split('T')[0]} onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">طريقة التسليم</label>
                    <select className="field py-3 rounded-xl bg-ink-50/30" value={editTask.submissionMethod || 'رفع ملف'} onChange={e => setEditTask({ ...editTask, submissionMethod: e.target.value })}>
                      <option value="رفع ملف">رفع ملف (صورة / مستند / فيديو)</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">مهلة الإنجاز بالساعات (اختياري)</label>
                    <input type="number" min={1} placeholder="بدون مهلة" className="field py-3 rounded-xl bg-ink-50/30 font-mono" value={editTask.timeLimitHours || ''} onChange={e => setEditTask({ ...editTask, timeLimitHours: e.target.value ? parseInt(e.target.value, 10) : null })} />
                  </div>
                </div>

                <div className="pt-4 border-t border-ink-150">
                  <label className="label font-bold text-ink-800 mb-3">تغيير الصورة التوضيحية (اختياري)</label>
                  <div onClick={() => editFileRef.current?.click()} className="border-2 border-dashed border-ink-200 rounded-2xl p-6 text-center cursor-pointer hover:bg-ink-50/50 transition-colors">
                    <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, true)} />
                    {editTask.imageUrl ? (
                      <div className="space-y-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editTask.imageUrl} alt="Preview" className="max-h-40 mx-auto rounded-xl shadow-sm" />
                        <button type="button" className="btn bg-white border-ink-200 text-sm font-bold shadow-sm" onClick={(e) => { e.stopPropagation(); setEditTask({ ...editTask, imageUrl: null }); }}>إزالة الصورة</button>
                      </div>
                    ) : (
                      <div className="text-ink-400 text-sm font-medium">🖼️ اضغط لرفع صورة جديدة للمهمة</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label font-bold text-ink-800 mb-2">المشرف المسؤول عن التقييم</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <button type="button" onClick={() => setEditTask({ ...editTask, assignedAdmins: [] })} className={`choice text-[0.8rem] font-bold py-2 px-4 rounded-xl ${editTask.assignedAdmins.length === 0 ? 'is-active' : ''}`}>جميع المشرفين</button>
                    {supervisors.map(s => (
                      <button key={s.id} type="button" onClick={() => toggleAdminChip(String(s.id), true)} className={`choice text-[0.8rem] font-bold py-2 px-4 rounded-xl ${editTask.assignedAdmins.includes(String(s.id)) ? 'is-active' : ''}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl">
                <button type="button" onClick={() => setEditTask(null)} className="btn bg-white border border-ink-200 text-ink-600 text-[0.95rem] font-bold rounded-xl py-3 px-6">إلغاء</button>
                <button type="submit" disabled={editBusy} className="btn bg-brand-500 hover:bg-brand-600 text-white text-[0.95rem] font-bold rounded-xl py-3 px-8 shadow-brand transition-all">
                  {editBusy ? 'جاري الحفظ…' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: VISIBILITY SCOPE */}
      {scopeTask && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setScopeTask(null)}>
          <div className="modal-panel w-full max-w-lg shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-extrabold text-ink-900">تعديل النطاق:</h3>
                <div className="text-[0.9rem] font-bold text-ink-500 mt-1">{scopeTask.title}</div>
              </div>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors" onClick={() => setScopeTask(null)}>×</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setScopeTask({ ...scopeTask, visibility: 'all' })}
                  className={`flex-1 text-center py-3 rounded-xl font-bold border transition-all ${scopeTask.visibility === 'all' ? 'bg-brand text-white border-brand shadow-brand' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
                >
                  🌐 متاحة للجميع
                </button>
                <button
                  type="button"
                  onClick={() => setScopeTask({ ...scopeTask, visibility: 'restricted' })}
                  className={`flex-1 text-center py-3 rounded-xl font-bold border transition-all ${scopeTask.visibility === 'restricted' ? 'bg-brand text-white border-brand shadow-brand' : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
                >
                  👥 طلاب محددون فقط
                </button>
              </div>

              {scopeTask.visibility === 'restricted' && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative flex-1 w-full">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">🔍</span>
                      <input type="text" className="field pl-3 pr-9 py-2 text-[0.85rem] rounded-lg w-full" placeholder="ابحث باسم الطالب..." value={scopeSearch} onChange={e => setScopeSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button type="button" className="btn bg-ink-100 hover:bg-ink-200 text-ink-800 py-2 px-3 text-[0.75rem] font-bold rounded-lg flex-1 sm:flex-none" onClick={() => {
                        const query = scopeSearch.trim().toLowerCase();
                        const toSelect = students.filter(s => (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted') && (!query || s.studentName.toLowerCase().includes(query))).map(s => s.id);
                        setScopeSelected(Array.from(new Set([...scopeSelected, ...toSelect])));
                      }}>
                        تحديد النتائج
                      </button>
                      <button type="button" className="btn bg-white border border-ink-200 text-ink-600 hover:bg-ink-50 py-2 px-3 text-[0.75rem] font-bold rounded-lg flex-1 sm:flex-none" onClick={() => setScopeSelected([])}>
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-ink-200 rounded-xl p-3 space-y-2 scroll-soft bg-ink-50/30">
                    {students.filter(s => (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted') && (!scopeSearch.trim() || s.studentName.toLowerCase().includes(scopeSearch.trim().toLowerCase()))).map(student => {
                      const checked = scopeSelected.includes(student.id);
                      return (
                        <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer text-[0.85rem] transition-colors border border-transparent hover:border-ink-150 hover:shadow-sm">
                          <input type="checkbox" checked={checked} className="accent-brand w-4 h-4" onChange={() => setScopeSelected(checked ? scopeSelected.filter(id => id !== student.id) : [...scopeSelected, student.id])} />
                          <span className="font-bold text-ink-800">{student.studentName} <span className="text-ink-400 font-normal">({student.stage} - {student.grade})</span></span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-[0.85rem] text-brand-600 font-extrabold bg-brand-50 border border-brand-100 rounded-lg py-2 px-4 inline-block">
                    تم تحديد: {scopeSelected.length} طالب
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl">
              <button onClick={() => setScopeTask(null)} className="btn bg-white border border-ink-200 text-ink-600 text-[0.95rem] font-bold rounded-xl py-3 px-6">إلغاء</button>
              <button onClick={handleScopeConfirm} disabled={scopeBusy || (scopeTask.visibility === 'restricted' && scopeSelected.length === 0)} className="btn bg-brand-500 hover:bg-brand-600 text-white text-[0.95rem] font-bold rounded-xl py-3 px-8 shadow-brand transition-all">
                {scopeBusy ? 'جارٍ الحفظ…' : 'تحديث النطاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STATISTICS */}
      {statsTask && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setStatsTask(null)}>
          <div className="modal-panel w-full max-w-3xl shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-extrabold text-ink-900">إحصائيات تسليمات الطلاب</h3>
                <div className="text-[0.9rem] font-bold text-ink-500 mt-1">{statsTask.title}</div>
              </div>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors" onClick={() => setStatsTask(null)}>×</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Stats Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-ink-50 p-4 rounded-xl border border-ink-150 shadow-sm">
                  <div className="text-3xl font-extrabold text-ink-800">{statsCounts.total}</div>
                  <div className="text-[0.8rem] text-ink-500 font-bold mt-1">إجمالي المستهدفين</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="text-3xl font-extrabold text-emerald-600">{statsCounts.submitted}</div>
                  <div className="text-[0.8rem] text-emerald-700 font-bold mt-1">تم التسليم</div>
                </div>
                <div className="bg-nred-50 p-4 rounded-xl border border-nred-100 shadow-sm">
                  <div className="text-3xl font-extrabold text-nred-600">{statsCounts.missing}</div>
                  <div className="text-[0.8rem] text-nred-700 font-bold mt-1">لم يسلموا</div>
                </div>
                <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 shadow-sm">
                  <div className="text-3xl font-extrabold text-brand-600">{statsCounts.pending}</div>
                  <div className="text-[0.8rem] text-brand-700 font-bold mt-1">بانتظار التقييم</div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400">🔍</span>
                  <input type="text" placeholder="ابحث عن طالب..." className="field pl-3 pr-9 py-2.5 text-[0.85rem] rounded-xl w-full bg-ink-50/30 border-ink-200 focus:bg-white" value={statsSearch} onChange={e => setStatsSearch(e.target.value)} />
                </div>
                <select className="field py-2.5 px-3 text-[0.85rem] rounded-xl sm:w-56 bg-ink-50/30 border-ink-200 focus:bg-white" value={statsFilter} onChange={e => setStatsFilter(e.target.value as any)}>
                  <option value="all">جميع الطلاب المشمولين</option>
                  <option value="submitted">الذين سلّموا فقط</option>
                  <option value="missing">الذين لم يسلّموا</option>
                </select>
              </div>

              {/* Table */}
              <div className="max-h-64 overflow-y-auto border border-ink-150 rounded-xl bg-white shadow-sm scroll-soft">
                {statsStudentList.length === 0 ? (
                  <div className="text-center py-12 text-ink-400 font-medium text-[0.9rem]">لا يوجد طلاب يطابقون الفلاتر المحددة.</div>
                ) : (
                  <table className="w-full text-right text-[0.85rem]">
                    <thead className="bg-ink-50/80 sticky top-0 border-b border-ink-150 text-ink-500">
                      <tr>
                        <th className="py-3 px-4 font-bold">الطالب</th>
                        <th className="py-3 px-4 font-bold">الحالة</th>
                        <th className="py-3 px-4 font-bold text-center">الدرجة</th>
                        <th className="py-3 px-4 font-bold">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsStudentList.map((item, i) => (
                        <tr key={item.id} className={`border-b border-ink-100 last:border-0 hover:bg-cream-100/50 ${i % 2 === 0 ? 'bg-white' : 'bg-ink-50/10'}`}>
                          <td className="py-3 px-4">
                            <span className="font-extrabold text-ink-900">{item.studentName}</span>
                            <span className="text-ink-400 mr-2">({item.stage} - {item.grade})</span>
                          </td>
                          <td className="py-3 px-4">
                            {item.submitted ? (
                              <span className={`px-2.5 py-1 rounded-full text-[0.7rem] font-bold ${statusBadgeClass(item.submission!.status)}`}>
                                {statusLabel(item.submission!.status)}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[0.7rem] font-bold bg-nred-50 text-nred-600 border border-nred-200">لم يسلّم بعد</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-center text-[0.95rem]">
                            {item.submission?.status === 'approved' ? (
                              <span className="text-emerald-600">{item.submission.grade} 🎯</span>
                            ) : (
                              <span className="text-ink-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[0.75rem] text-ink-500 font-medium">
                            {item.submission ? item.submission.submittedAt.split('T')[0] : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl">
              <button onClick={() => setStatsTask(null)} className="btn bg-brand-500 hover:bg-brand-600 text-white text-[0.95rem] font-bold rounded-xl py-3 px-8 shadow-brand">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* SUBMISSION CARD COMPONENT */
function SubmissionCard({
  sub, onEvaluate, supervisors, isLog = false,
  inlineEditSub, inlinePoints, setInlineEditSub, setInlinePoints, saveInlinePoints, inlineBusy
}: any) {
  const isPending = sub.status === 'pending';
  const isApproved = sub.status === 'approved';
  const isRejected = sub.status === 'rejected';

  const borderColor = isPending ? 'border-brand-500' : isApproved ? 'border-emerald-500' : 'border-nred-500';
  
  const assignedLabel = sub.taskAssignedAdmins?.length === 0 ? 'جميع المشرفين' : sub.taskAssignedAdmins?.map((id: string) => supervisors.find((s: any) => String(s.id) === id)?.name).filter(Boolean).join('، ');
  
  return (
    <div className={`bg-white rounded-2xl p-5 md:p-6 relative transition-all duration-200 hover:shadow-md border border-ink-150 border-r-4 ${borderColor} mb-4 shadow-sm`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        
        {/* Right side (RTL): Avatar & Name */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold flex items-center justify-center text-xl shrink-0 border border-emerald-100 shadow-sm">
            {sub.studentName?.charAt(0) || 'ط'}
          </div>
          <div>
            <h4 className="font-extrabold text-ink-900 text-[1.05rem]">{sub.studentName}</h4>
            <span className="text-[0.75rem] text-ink-400 font-mono inline-block mt-0.5 font-medium">
              تاريخ التسليم: {sub.submittedAt.split('T')[0]}
            </span>
          </div>
        </div>

        {/* Left side (RTL): Badges */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`px-3 py-1 rounded-full font-bold text-[0.7rem] ${getTrackPillClass(sub.taskTrack)}`}>
            {sub.taskTrack || 'عام'}
          </span>
          <span className={`px-3 py-1 rounded-full text-[0.7rem] font-bold shadow-sm ${isPending ? 'bg-brand-50 text-brand-700 border border-brand-200' : isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-nred-50 text-nred-700 border border-nred-200'}`}>
            {statusLabel(sub.status)}
          </span>
        </div>
      </div>

      <div className="mb-5">
        <div className="font-extrabold text-ink-900 text-lg mb-1.5">{sub.taskTitle}</div>
        <div className="text-[0.8rem] text-ink-500 font-bold mb-3">المشرف المسؤول: <span className="text-ink-700 font-medium">{assignedLabel}</span></div>
        <div className="inline-flex items-center gap-1.5 bg-ink-50 text-ink-700 border border-ink-200 px-3 py-1.5 rounded-lg text-[0.8rem] font-bold shadow-sm">
          الحد الأقصى: <span className="text-brand-600">{sub.taskMaxPoints} 🎯</span>
        </div>
      </div>

      {sub.fileUrl && (
        <div className="bg-cream-100/60 p-5 rounded-2xl border border-ink-150 mb-5 shadow-inner">
          <div className="text-[0.8rem] text-ink-400 font-bold mb-3">محتوى التسليم المرفق</div>
          {sub.fileUrl.startsWith('data:image') || sub.fileUrl.startsWith('http') && sub.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sub.fileUrl} alt="إثبات الإنجاز" className="max-h-56 rounded-xl border border-ink-200 cursor-zoom-in shadow-sm mx-auto" onClick={() => window.open(sub.fileUrl, '_blank')} />
          ) : sub.fileUrl === 'admin://manual-mark' ? (
            <div className="text-[0.9rem] text-ink-600 font-medium italic text-center py-3">إقرار تسليم يدوي مباشر من المشرف</div>
          ) : (
            <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 bg-white hover:bg-brand-50 border border-ink-200 font-bold text-[0.9rem] block text-center py-3 rounded-xl transition-colors shadow-sm">
              📄 عرض المستند المرفق (اضغط للفتح)
            </a>
          )}
        </div>
      )}

      {/* Reviewer / Grade / Feedback */}
      {!isPending && (
        <div className="pt-5 border-t border-ink-150">
          {isApproved && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                {inlineEditSub === sub.id ? (
                  <div className="flex items-center gap-2 bg-ink-50/50 p-2 rounded-xl border border-ink-200" onClick={e => e.stopPropagation()}>
                    <input type="number" min={0} max={sub.taskMaxPoints} className="field py-1.5 px-3 w-24 text-center font-extrabold text-[0.95rem] text-brand-600 rounded-lg border-brand-200" value={inlinePoints} onChange={e => setInlinePoints?.(e.target.value.replace(/\D/g, ''))} />
                    <button onClick={() => saveInlinePoints?.(sub)} disabled={inlineBusy} className="btn bg-brand-500 hover:bg-brand-600 text-white py-1.5 px-4 rounded-lg text-xs font-bold shadow-sm">حفظ</button>
                    <button onClick={() => setInlineEditSub?.(null)} className="btn bg-white border-ink-200 text-ink-600 py-1.5 px-4 rounded-lg text-xs font-bold shadow-sm">إلغاء</button>
                  </div>
                ) : (
                  <>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl font-extrabold text-[0.9rem] flex items-center gap-2 shadow-sm">
                      النقاط الممنوحة: {sub.grade} / {sub.taskMaxPoints} 🎯
                    </span>
                    <button onClick={() => { setInlineEditSub?.(sub.id); setInlinePoints?.(String(sub.grade || 0)); }} className="text-brand-600 hover:text-white bg-white hover:bg-brand-500 border border-brand-200 hover:border-brand-500 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
                      ✏️ تعديل النقاط
                    </button>
                  </>
                )}
              </div>
              {sub.feedback && (
                <div className="text-[0.85rem] text-ink-500 font-medium italic mt-2 sm:mt-0 bg-ink-50/50 px-4 py-2 rounded-lg border border-ink-150">
                  <span className="font-bold text-ink-700">التعليق:</span> "{sub.feedback}"
                </div>
              )}
            </div>
          )}
          {isRejected && (
             <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
               <span className="text-nred-600 font-extrabold bg-nred-50 py-1.5 px-4 rounded-xl border border-nred-200 text-[0.85rem] shadow-sm">
                 تم رد المهمة
               </span>
               {sub.feedback && (
                 <div className="text-[0.85rem] text-nred-600 font-medium italic bg-nred-50/50 px-4 py-2 rounded-lg border border-nred-100">
                   <span className="font-bold">السبب:</span> "{sub.feedback}"
                 </div>
               )}
             </div>
          )}
        </div>
      )}

      {/* Evaluate Buttons */}
      {isPending && onEvaluate && (
        <div className="mt-4 flex justify-end pt-5 border-t border-ink-150">
           <button onClick={() => onEvaluate(sub)} className="btn bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-8 rounded-xl text-[0.9rem] shadow-brand transition-colors w-full sm:w-auto">
              مراجعة وتقييم التسليم
           </button>
        </div>
      )}
    </div>
  );
}
