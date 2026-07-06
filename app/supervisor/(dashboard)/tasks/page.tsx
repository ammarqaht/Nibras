'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';

type Student = { id: number; membershipNo: number; studentName: string; stage: string; grade: string; registrationStatus: string; paymentStatus?: string; groupId: number | null };
type SupervisorUser = { id: number; name: string; email: string };
type Task = {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
  startDate: string | null;
  dueDate: string;
  createdAt: string;
  track: string | null;
  stage: string | null;
  isActive: boolean;
  submissionMethod: string | null;
  durationHours: number | null;
  lateAfterHours: number | null;
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
  wasLate?: boolean;
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

const parseTaskImages = (urlStr: string | null): string[] => {
  if (!urlStr) return [];
  if (urlStr.startsWith('[')) {
    try { return JSON.parse(urlStr); } catch { return [urlStr]; }
  }
  if (urlStr.includes('|||')) {
    return urlStr.split('|||').filter(Boolean);
  }
  return [urlStr];
};


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

// Colored status dot (used in the stats popup where the status is expressed by color only)
function statusDotClass(status: string) {
  if (status === 'approved') return 'bg-emerald-500';
  if (status === 'rejected') return 'bg-nred-500';
  if (status === 'pending') return 'bg-brand-500';
  if (status === 'missing') return 'bg-ink-300';
  return 'bg-ink-300';
}
function statusText(status: string) {
  if (status === 'approved') return 'مقبولة';
  if (status === 'rejected') return 'مردودة';
  if (status === 'pending') return 'بانتظار التقييم';
  return 'لم تسلم';
}

function getTrackPillClass(track: string | null) {
  const t = track || 'عام';
  if (t === 'الثقافي' || t === 'ثقافي') return 'bg-yellow-50 text-yellow-700 border border-yellow-200/60';
  if (t === 'مسار تقني' || t === 'تقني') return 'bg-ncyan-50 text-ncyan-700 border border-ncyan-200/60';
  if (t === 'الذاكرة الحديدية') return 'bg-purple-50 text-purple-700 border border-purple-200/60';
  if (t === 'الاجتماعي' || t === 'اجتماعي') return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
  if (t === 'مسار إعلامي' || t === 'إعلامي') return 'bg-ink-100 text-ink-700 border border-ink-200';

  const TRACK_PALETTE = [
    'bg-yellow-50 text-yellow-700 border border-yellow-200/60',
    'bg-ncyan-50 text-ncyan-700 border border-ncyan-200/60',
    'bg-purple-50 text-purple-700 border border-purple-200/60',
    'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    'bg-pink-50 text-pink-700 border border-pink-200/60',
    'bg-rose-50 text-rose-700 border border-rose-200/60',
    'bg-blue-50 text-blue-700 border border-blue-200/60',
    'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
    'bg-orange-50 text-orange-700 border border-orange-200/60',
    'bg-teal-50 text-teal-700 border border-teal-200/60',
  ];
  let h = 0;
  for (let i = 0; i < t.length; i++) h = t.charCodeAt(i) + ((h << 5) - h);
  return TRACK_PALETTE[Math.abs(h) % TRACK_PALETTE.length];
}

export default function TasksPage() {
  const { user } = useSupervisor();
  const roles = useMemo(() => (user?.role || '').split(',').map(r => r.trim()), [user]);
  const isScientific = useMemo(() => roles.includes('scientific_supervisor') || roles.includes('admin'), [roles]);
  // Admins/scientific see and grade all submissions; other supervisors only
  // receive submissions for tasks assigned to them and may grade those. Since
  // the submissions list is already scoped server-side, any supervisor may grade
  // what they can see (the API enforces the assignment rule as well).
  const canGrade = useMemo(() => !!user, [user]);

  const [activeTab, setActiveTab] = useState<'manage' | 'submissions' | 'log' | 'add'>('manage');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'submissions' || tabParam === 'log' || tabParam === 'add' || tabParam === 'manage') {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Submissions search/filter states
  const [subSearch, setSubSearch] = useState('');
  const [subTaskFilter, setSubTaskFilter] = useState('');
  const [subAdminFilter, setSubAdminFilter] = useState('');

  // Log filter/sorting states
  const [logSearch, setLogSearch] = useState('');
  const [logTaskFilter, setLogTaskFilter] = useState('');
  const [logAdminFilter, setLogAdminFilter] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('');

  const [manageSearch, setManageSearch] = useState('');
  const [manageTrackFilter, setManageTrackFilter] = useState('');
  const [manageSortFilter, setManageSortFilter] = useState('default');
  const [manageStageFilter, setManageStageFilter] = useState<string[]>([]);

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
  const [scopeTab, setScopeTab] = useState<'groups' | 'students'>('groups');
  const [groups, setGroups] = useState<any[]>([]);

  const [statsTask, setStatsTask] = useState<Task | null>(null);
  const [statsSearch, setStatsSearch] = useState('');
  const [statsFilter, setStatsFilter] = useState<'all' | 'submitted' | 'missing'>('all');

  // Add task state
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addPoints, setAddPoints] = useState('10');
  const [addStartDate, setAddStartDate] = useState('');
  const [addDeadline, setAddDeadline] = useState('');
  const [addMethod, setAddMethod] = useState('رفع ملف');
  const [addLateAfter, setAddLateAfter] = useState('');
  const [addTimeLimit, setAddTimeLimit] = useState('');
  const [addResourceLink, setAddResourceLink] = useState('');
  const [addImages, setAddImages] = useState<string[]>([]);
  const [addAdmins, setAddAdmins] = useState<string[]>([]);
  const [addTrack, setAddTrack] = useState('عام');
  const [addBusy, setAddBusy] = useState(false);

  const [addStages, setAddStages] = useState<string[]>([]);
  const [editStages, setEditStages] = useState<string[]>([]);
  const [editTaskImages, setEditTaskImages] = useState<string[]>([]);

  // Tracks management states
  const [tracks, setTracks] = useState<{ name: string }[]>([]);
  const [manageTracksOpen, setManageTracksOpen] = useState(false);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null); // null = list, -1 = adding, >=0 = editing index
  const [trackFormName, setTrackFormName] = useState('');
  const [saveTracksBusy, setSaveTracksBusy] = useState(false);

  const editFileRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const [studentsRes, supervisorsRes, tasksRes, submissionsRes, tracksRes, groupsRes] = await Promise.all([
        fetch('/api/supervisor/students', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks/supervisors', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks', { cache: 'no-store' }),
        fetch('/api/supervisor/submissions', { cache: 'no-store' }),
        fetch('/api/supervisor/tracks', { cache: 'no-store' }),
        fetch('/api/supervisor/groups', { cache: 'no-store' })
      ]);

      const studentsData = await studentsRes.json().catch(() => ({ students: [] }));
      const supervisorsData = await supervisorsRes.json().catch(() => ({ supervisors: [] }));
      const tasksData = await tasksRes.json().catch(() => ({ tasks: [] }));
      const submissionsData = await submissionsRes.json().catch(() => ({ submissions: [] }));
      const tracksData = await tracksRes.json().catch(() => ({ tracks: [] }));
      const groupsData = await groupsRes.json().catch(() => ({ groups: [] }));

      setStudents(studentsData.students ?? []);
      setSupervisors(supervisorsData.supervisors ?? []);
      setTasks(tasksData.tasks ?? []);
      setSubmissions(submissionsData.submissions ?? []);
      setTracks(tracksData.tracks ?? []);
      setGroups(groupsData.groups ?? []);
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

  useEffect(() => {
    if (editTask) {
      if (!editTask.stage || editTask.stage === 'الكل') {
        setEditStages(['ابتدائي', 'متوسط', 'ثانوي']);
      } else {
        setEditStages(editTask.stage.split(',').map(s => s.trim()));
      }
      setEditTaskImages(parseTaskImages(editTask.imageUrl));
    }
  }, [editTask]);

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
      // Multi-select stage filter: a task matches if it targets all stages
      // (الكل/empty) or any of its target stages is among the selected ones.
      let matchStage = manageStageFilter.length === 0;
      if (!matchStage) {
        const raw = (t.stage ?? '').trim();
        if (!raw || raw === 'الكل') matchStage = true;
        else matchStage = raw.split(',').map(s => s.trim()).filter(Boolean).some(s => manageStageFilter.includes(s));
      }
      return matchQ && matchTrack && matchStage;
    });
    
    if (manageSortFilter === 'points') {
      result = result.sort((a, b) => b.maxPoints - a.maxPoints);
    } else if (manageSortFilter === 'newest') {
      result = result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (manageSortFilter === 'dueDate') {
      result = result.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
    }
    return result;
  }, [tasks, manageSearch, manageTrackFilter, manageSortFilter, manageStageFilter]);

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
    if (addStages.length === 0) return pushToast('error', 'يرجى اختيار مرحلة مستهدفة واحدة على الأقل');

    setAddBusy(true);
    try {
      const res = await fetch('/api/supervisor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDesc.trim(),
          maxPoints: parseInt(addPoints, 10),
          startDate: addStartDate || null,
          dueDate: addDeadline,
          submissionMethod: addMethod,
          lateAfterHours: addLateAfter ? parseInt(addLateAfter, 10) * 24 : null,
          timeLimitHours: addTimeLimit ? parseInt(addTimeLimit, 10) * 24 : null,
          assignedAdmins: addAdmins,
          track: addTrack.trim() || 'عام',
          stage: addStages.join(', '),
          imageUrl: addImages.length > 0 ? JSON.stringify(addImages) : null,
          resourceLink: addResourceLink.trim() || null,
          visibility: 'all',
          visibleToIds: [],
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المهمة');

      pushToast('success', 'تم نشر المهمة بنجاح ✓');
      setAddTitle(''); setAddDesc(''); setAddPoints('10'); setAddStartDate(''); setAddDeadline(''); setAddMethod('رفع ملف'); setAddLateAfter(''); setAddTimeLimit(''); setAddResourceLink(''); setAddImages([]); setAddAdmins([]); setAddTrack('عام'); setAddStages([]);
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
    const maxAllowed = evalSub.wasLate ? Math.floor(evalSub.taskMaxPoints / 2) : evalSub.taskMaxPoints;
    if (status === 'approved' && (isNaN(grade) || grade < 0 || grade > maxAllowed)) {
      return pushToast('error', evalSub.wasLate
        ? `التسليم متأخر — يجب أن تكون الدرجة بين 0 و ${maxAllowed}`
        : `يجب أن تكون الدرجة بين 0 و ${maxAllowed}`);
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
    if (editStages.length === 0) return pushToast('error', 'يرجى اختيار مرحلة مستهدفة واحدة على الأقل');
    setEditBusy(true);
    try {
      const res = await fetch(`/api/supervisor/tasks/${editTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTask.title.trim(),
          description: editTask.description.trim(),
          maxPoints: editTask.maxPoints,
          startDate: editTask.startDate || null,
          dueDate: editTask.dueDate,
          track: editTask.track?.trim() || 'عام',
          stage: editStages.join(', '),
          submissionMethod: editTask.submissionMethod,
          timeLimitHours: editTask.durationHours,
          lateAfterHours: editTask.lateAfterHours,
          assignedAdmins: editTask.assignedAdmins,
          imageUrl: editTaskImages.length > 0 ? JSON.stringify(editTaskImages) : null,
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
    const capMax = sub.wasLate ? Math.floor(sub.taskMaxPoints / 2) : sub.taskMaxPoints;
    if (isNaN(val) || val < 0 || val > capMax) {
      return pushToast('error', sub.wasLate
        ? `التسليم متأخر — يجب أن تكون الدرجة بين 0 و ${capMax}`
        : `يجب أن تكون الدرجة بين 0 و ${capMax}`);
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

  // Returns the students actually targeted by a task: restricted tasks use the
  // explicit id list; otherwise students are scoped to the task's target stages.
  function scopedStudentsFor(task: Task) {
    const activeStudents = students.filter(s => s.registrationStatus === 'approved' || s.paymentStatus === 'exempted');
    if (task.visibility === 'restricted') {
      return activeStudents.filter(s => task.visibleToIds.includes(s.id));
    }
    const stages = (task.stage && task.stage.trim() && task.stage.trim() !== 'الكل')
      ? task.stage.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    return stages.length ? activeStudents.filter(s => stages.includes(s.stage)) : activeStudents;
  }

  // Order used in the stats list: awaiting review → submitted → rejected → not submitted.
  function statsStatusRank(item: { submitted: boolean; submission: Submission | null }) {
    if (!item.submitted || !item.submission) return 3; // لم يسلم
    if (item.submission.status === 'pending') return 0;  // بانتظار المراجعة
    if (item.submission.status === 'approved') return 1; // تم التسليم
    if (item.submission.status === 'rejected') return 2; // مردود
    return 3;
  }

  // Statistics modal helper
  const statsStudentList = useMemo(() => {
    if (!statsTask) return [];
    const scopedStudents = scopedStudentsFor(statsTask);
    const taskSubmissionsMap = new Map(submissions.filter(s => s.taskId === statsTask.id).map(s => [s.registrationId, s]));

    const list = scopedStudents.map(student => {
      const sub = taskSubmissionsMap.get(student.id);
      return { ...student, submitted: !!sub, submission: sub || null };
    });

    let filtered = list;
    if (statsSearch.trim()) filtered = list.filter(item => item.studentName.toLowerCase().includes(statsSearch.trim().toLowerCase()));
    if (statsFilter === 'submitted') filtered = filtered.filter(item => item.submitted);
    else if (statsFilter === 'missing') filtered = filtered.filter(item => !item.submitted);
    return [...filtered].sort((a, b) => statsStatusRank(a) - statsStatusRank(b));
  }, [statsTask, students, submissions, statsSearch, statsFilter]);

  const statsCounts = useMemo(() => {
    if (!statsTask) return { total: 0, submitted: 0, missing: 0, pending: 0 };
    const scopedStudents = scopedStudentsFor(statsTask);
    const scopedIds = new Set(scopedStudents.map(s => s.id));
    const taskSubmissions = submissions.filter(s => s.taskId === statsTask.id && scopedIds.has(s.registrationId));
    const submittedIds = new Set(taskSubmissions.map(s => s.registrationId));
    const total = scopedStudents.length;
    const submitted = scopedStudents.filter(s => submittedIds.has(s.id)).length;
    const pending = taskSubmissions.filter(s => s.status === 'pending').length;
    const missing = total - submitted;
    return { total, submitted, missing, pending };
  }, [statsTask, students, submissions]);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const base64s: string[] = [];
      for (const file of Array.from(files)) {
        const base64 = await compressImage(file, 1200, 0.7);
        base64s.push(base64);
      }
      if (isEdit) {
        setEditTaskImages(prev => [...prev, ...base64s]);
      } else {
        setAddImages(prev => [...prev, ...base64s]);
      }
      pushToast('success', `تم تجهيز ${files.length} صور بنجاح ✓`);
    } catch {
      pushToast('error', 'تعذر معالجة بعض الصور');
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setManageTracksOpen(true);
                        setEditingTrackIndex(null);
                      }}
                      className="btn border border-ink-200 text-ink-700 bg-white hover:bg-ink-50 rounded-xl px-5 py-3 font-bold shadow-soft flex items-center gap-1.5"
                    >
                      ⚙️ تعديل وإضافة المسارات
                    </button>
                    <button onClick={() => setActiveTab('add')} className="btn bg-ink-900 text-white hover:bg-ink-800 rounded-xl px-5 py-3 font-bold shadow-soft">
                      + إضافة مهمة جديدة
                    </button>
                  </div>
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
                    {tracks.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                  <select className="field py-2.5 px-3 text-[0.9rem] flex-1 md:w-48 rounded-xl bg-ink-50/30 border-transparent focus:bg-white" value={manageSortFilter} onChange={e => setManageSortFilter(e.target.value)}>
                    <option value="default">الترتيب الافتراضي</option>
                    <option value="newest">الأحدث أولاً</option>
                    <option value="points">الأكثر نقاطاً</option>
                    <option value="dueDate">حسب الاستحقاق</option>
                  </select>
                </div>
              </div>

              {/* Multi-select stage filter */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-[0.82rem] font-bold text-ink-500">المراحل:</span>
                {['ابتدائي', 'متوسط', 'ثانوي'].map(st => {
                  const active = manageStageFilter.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setManageStageFilter(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}
                      className={`choice text-xs font-bold px-4 py-1.5 rounded-xl ${active ? 'is-active' : ''}`}
                    >
                      {st}
                    </button>
                  );
                })}
                {manageStageFilter.length > 0 && (
                  <button type="button" onClick={() => setManageStageFilter([])} className="text-xs text-ink-400 hover:text-nred-500 px-1 font-semibold">
                    مسح
                  </button>
                )}
              </div>

              {/* Tasks List — cards */}
              {filteredTasks.length === 0 ? (
                <div className="card p-16 text-center text-ink-400 border border-ink-150 shadow-soft">لا توجد مهام مطابقة للبحث.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredTasks.map(task => (
                    <div
                      key={task.id}
                      className={`card p-0 overflow-hidden border border-ink-150 shadow-soft flex flex-col transition-all hover:shadow-md ${!task.isActive ? 'opacity-70' : ''}`}
                      style={{ borderTop: `3px solid ${task.isActive ? 'var(--accent, #FF9F1C)' : '#CBD5E1'}` }}
                    >
                      {/* Header: title + description */}
                      <div className="p-4 pb-3 flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3 className="font-bold text-ink-900 text-[0.95rem] leading-snug truncate flex-1">{task.title}</h3>
                          {!task.isActive && <span className="shrink-0 text-[0.65rem] font-bold text-ink-500 bg-ink-100 px-2 py-0.5 rounded-full">معطّلة</span>}
                        </div>
                        <p className="text-[0.8rem] text-ink-400 line-clamp-2 leading-relaxed">{task.description}</p>

                        {/* Meta pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          <span className={`px-2.5 py-1 rounded-full text-[0.72rem] font-bold ${getTrackPillClass(task.track)}`}>
                            {task.track || 'عام'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 inline-flex items-center gap-1">
                            🏷️ {task.stage || 'الكل'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-brand-50 text-brand-700 border border-brand-200/60 inline-flex items-center gap-1">
                            🎯 {task.maxPoints}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-nblue-50 text-nblue-700 border border-nblue-200/50 inline-flex items-center gap-1 font-mono">
                            📅 {task.dueDate.split('T')[0]}
                          </span>
                          {(task.lateAfterHours || task.durationHours) && (
                            <span className="px-2.5 py-1 rounded-full text-[0.72rem] font-bold bg-ink-50 text-ink-500 border border-ink-150 inline-flex items-center gap-1 whitespace-nowrap">
                              ⏳ {task.lateAfterHours ? `${Math.round(task.lateAfterHours / 24)}ي` : '—'} / {task.durationHours ? `${Math.round(task.durationHours / 24)}ي` : '—'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex flex-wrap gap-2 p-3 border-t border-ink-100 bg-cream-50/40">
                        {isScientific && (
                          <>
                            <button
                              className="border border-ncyan-600/30 text-ncyan-700 bg-ncyan-50/60 hover:bg-ncyan-100/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              onClick={() => setEditTask(task)}
                            >
                              تعديل
                            </button>
                            <button
                              className={`border px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${task.isActive ? 'border-brand/40 text-brand-700 bg-brand-50/60 hover:bg-brand-100/60' : 'border-emerald-600/30 text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100/60'}`}
                              onClick={() => toggleTaskActive(task)}
                            >
                              {task.isActive ? 'تعطيل' : 'تفعيل'}
                            </button>
                            <button
                              className="border border-purple-500/30 text-purple-700 bg-purple-50/60 hover:bg-purple-100/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                              onClick={() => { setScopeTask(task); setScopeSelected(task.visibleToIds || []); setScopeSearch(''); }}
                            >
                              النطاق
                            </button>
                          </>
                        )}
                        <button
                          className="border border-nblue-400/30 text-nblue-700 bg-nblue-50/60 hover:bg-nblue-100/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          onClick={() => { setStatsTask(task); setStatsSearch(''); setStatsFilter('all'); }}
                        >
                          تسليمات
                        </button>
                        {isScientific && (
                          <button
                            className="border border-nred-400/30 text-nred-700 bg-nred-50/60 hover:bg-nred-100/60 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors mr-auto"
                            onClick={() => handleTaskDelete(task.id, task.title)}
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    <SubmissionCard key={sub.id} sub={sub} onEvaluate={canGrade ? setEvalSub : undefined} supervisors={supervisors} />
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
                      key={sub.id} sub={sub} supervisors={supervisors} isLog canGrade={canGrade}
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
                      {tracks.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">المراحل المستهدفة <span className="req">*</span></label>
                    <div className="flex gap-2">
                      {['ابتدائي', 'متوسط', 'ثانوي'].map(st => {
                        const active = addStages.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setAddStages(prev =>
                                prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]
                              );
                            }}
                            className={`choice flex-1 text-xs font-bold rounded-xl text-center ${active ? 'is-active' : ''}`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">وقت البداية (ظهور المهمة)</label>
                    <input type="date" className="field py-3 rounded-xl bg-ink-50/20 font-mono" value={addStartDate} onChange={e => setAddStartDate(e.target.value)} />
                    <p className="text-[0.7rem] text-ink-400 mt-1">اتركه فارغاً لتظهر المهمة فوراً.</p>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">تاريخ إغلاق المهمة <span className="req">*</span></label>
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
                      <option value="نص">إجابة نصية</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">مدة المهمة (أيام — بعدها متأخر)</label>
                    <input type="number" min={1} placeholder="مثال: 1" className="field py-3 rounded-xl bg-ink-50/20 font-mono" value={addLateAfter} onChange={e => setAddLateAfter(e.target.value.replace(/\D/g, ''))} />
                    <p className="text-[0.7rem] text-ink-400 mt-1">إذا تجاوزها الطالب لا يستحق التقييم الكامل.</p>
                  </div>
                  <div>
                    <label className="label mb-1.5 font-bold text-ink-800">مدة الاستحقاق (أيام — بعدها تُلغى)</label>
                    <input type="number" min={1} placeholder="مثال: 2" className="field py-3 rounded-xl bg-ink-50/20 font-mono" value={addTimeLimit} onChange={e => setAddTimeLimit(e.target.value.replace(/\D/g, ''))} />
                    <p className="text-[0.7rem] text-ink-400 mt-1">إذا تجاوزها الطالب تُلغى عليه ولا يسترد النقاط.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-ink-150">
                  <label className="label mb-3 font-bold text-ink-800">صور توضيحية للمهمة (اختياري)</label>
                  <div onClick={() => addFileRef.current?.click()} className="border-2 border-dashed border-ink-200 bg-ink-50/30 hover:bg-cream-100 rounded-2xl p-8 text-center cursor-pointer transition-colors">
                    <input ref={addFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagePick(e, false)} />
                    {addImages.length > 0 ? (
                      <div className="space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {addImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-ink-150 group shadow-sm bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md transition-colors"
                                onClick={() => setAddImages(prev => prev.filter((_, i) => i !== idx))}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="btn btn-secondary text-sm font-bold bg-white border border-ink-200 px-4 py-2 rounded-xl" onClick={() => addFileRef.current?.click()}>إضافة المزيد من الصور</button>
                      </div>
                    ) : (
                      <div className="text-ink-500 text-[0.95rem] flex flex-col items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-ink-300 border border-ink-150">
                           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </div>
                        <span className="font-medium">اضغط لاختيار صورة أو صور متعددة للمهمة</span>
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
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={() => setEvalSub(null)}>
          <div className="modal-panel w-[92vw] sm:w-full sm:max-w-xl rounded-2xl max-h-[85vh] flex flex-col shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl shrink-0">
              <h3 className="text-lg sm:text-xl font-extrabold text-ink-900">مراجعة وتقييم المهمة</h3>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors leading-none" onClick={() => setEvalSub(null)}>×</button>
            </div>
            <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto scroll-soft">
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

              {evalSub.wasLate && (
                <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-xl p-3 text-[0.85rem] font-bold flex items-center gap-2">
                  <span>⏰</span>
                  <span>تسليم متأخر — الحد الأقصى للنقاط {Math.floor(evalSub.taskMaxPoints / 2)} من {evalSub.taskMaxPoints}</span>
                </div>
              )}

              <div className="bg-white p-5 rounded-2xl border border-ink-200 shadow-sm">
                {(() => {
                  const capMax = evalSub.wasLate ? Math.floor(evalSub.taskMaxPoints / 2) : evalSub.taskMaxPoints;
                  return (
                    <>
                      <label className="label font-bold text-ink-900 text-[0.95rem] mb-3">النقاط الممنوحة (🎯) (الحد الأقصى: {capMax})</label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <input type="number" min={0} max={capMax} className="field w-28 text-center font-extrabold text-2xl py-3 text-brand-600 border-brand-200 bg-brand-50/30 rounded-xl" value={evalPoints === '' ? capMax : evalPoints} onChange={e => setEvalPoints(e.target.value.replace(/\D/g, ''))} />
                        <div className="flex-1 flex gap-2">
                          <button type="button" onClick={() => setEvalPoints(String(capMax))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">كامل</button>
                          <button type="button" onClick={() => setEvalPoints(String(Math.round(capMax * 0.75)))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">75%</button>
                          <button type="button" onClick={() => setEvalPoints(String(Math.round(capMax * 0.5)))} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">50%</button>
                          <button type="button" onClick={() => setEvalPoints('0')} className="btn bg-ink-50 hover:bg-ink-100 text-ink-800 border-transparent text-[0.8rem] flex-1 py-3 rounded-xl font-bold">صفر</button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="label font-bold text-ink-800 mb-2">تعليق أو توجيه للطالب (اختياري)</label>
                <textarea className="field py-3 rounded-xl bg-ink-50/30" rows={2} placeholder="مثال: ممتاز، استمر في هذا التميز!" value={evalComment} onChange={e => setEvalComment(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 sm:p-5 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl shrink-0">
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
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={() => setEditTask(null)}>
          <div className="modal-panel w-[92vw] sm:w-full sm:max-w-xl rounded-2xl max-h-[85vh] flex flex-col shadow-elevated" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateTask} autoComplete="off" className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl shrink-0">
                <h3 className="text-lg sm:text-xl font-extrabold text-ink-900">تعديل بيانات المهمة</h3>
                <button type="button" className="text-3xl text-ink-400 hover:text-ink-900 leading-none" onClick={() => setEditTask(null)}>×</button>
              </div>
              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto scroll-soft">
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
                      {tracks.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">المراحل المستهدفة <span className="req">*</span></label>
                    <div className="flex gap-2">
                      {['ابتدائي', 'متوسط', 'ثانوي'].map(st => {
                        const active = editStages.includes(st);
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setEditStages(prev =>
                                prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]
                              );
                            }}
                            className={`choice flex-1 text-xs font-bold rounded-xl text-center ${active ? 'is-active' : ''}`}
                          >
                            {st}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">النقاط (🎯)</label>
                    <input type="number" className="field py-3 rounded-xl bg-ink-50/30 text-center font-extrabold text-brand-600 w-full" required min={1} value={editTask.maxPoints} onChange={e => setEditTask({ ...editTask, maxPoints: parseInt(e.target.value.replace(/\D/g, ''), 10) || 1 })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">وقت البداية (اختياري)</label>
                    <input type="date" className="field py-3 rounded-xl bg-ink-50/30 font-mono" value={editTask.startDate ? editTask.startDate.split('T')[0] : ''} onChange={e => setEditTask({ ...editTask, startDate: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">تاريخ إغلاق المهمة</label>
                    <input type="date" className="field py-3 rounded-xl bg-ink-50/30 font-mono" required value={editTask.dueDate.split('T')[0]} onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">طريقة التسليم</label>
                    <select className="field py-3 rounded-xl bg-ink-50/30" value={editTask.submissionMethod || 'رفع ملف'} onChange={e => setEditTask({ ...editTask, submissionMethod: e.target.value })}>
                      <option value="رفع ملف">رفع ملف (صورة / مستند / فيديو)</option>
                      <option value="نص">إجابة نصية</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">مدة المهمة (أيام — بعدها متأخر)</label>
                    <input type="number" min={1} placeholder="بدون" className="field py-3 rounded-xl bg-ink-50/30 font-mono" value={editTask.lateAfterHours ? Math.round(editTask.lateAfterHours / 24) : ''} onChange={e => setEditTask({ ...editTask, lateAfterHours: e.target.value ? parseInt(e.target.value, 10) * 24 : null })} />
                  </div>
                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">مدة الاستحقاق (أيام — بعدها تُلغى)</label>
                    <input type="number" min={1} placeholder="بدون" className="field py-3 rounded-xl bg-ink-50/30 font-mono" value={editTask.durationHours ? Math.round(editTask.durationHours / 24) : ''} onChange={e => setEditTask({ ...editTask, durationHours: e.target.value ? parseInt(e.target.value, 10) * 24 : null })} />
                  </div>
                </div>

                <div className="pt-4 border-t border-ink-150">
                  <label className="label font-bold text-ink-800 mb-3">الصور التوضيحية للمهمة (اختياري)</label>
                  <div onClick={() => editFileRef.current?.click()} className="border-2 border-dashed border-ink-200 rounded-2xl p-6 text-center cursor-pointer hover:bg-ink-50/50 transition-colors">
                    <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImagePick(e, true)} />
                    {editTaskImages.length > 0 ? (
                      <div className="space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {editTaskImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-ink-150 group shadow-sm bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md transition-colors"
                                onClick={() => setEditTaskImages(prev => prev.filter((_, i) => i !== idx))}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                        <button type="button" className="btn btn-secondary text-sm font-bold bg-white border border-ink-200 px-4 py-2 rounded-xl" onClick={() => editFileRef.current?.click()}>إضافة المزيد من الصور</button>
                      </div>
                    ) : (
                      <div className="text-ink-400 text-sm font-medium">🖼️ اضغط لرفع صور توضيحية للمهمة</div>
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
              <div className="flex justify-end gap-3 p-4 sm:p-5 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl shrink-0">
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
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={() => setScopeTask(null)}>
          <div className="modal-panel w-[92vw] sm:w-full sm:max-w-xl rounded-2xl max-h-[85vh] flex flex-col shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-ink-900">تعديل النطاق:</h3>
                <div className="text-[0.9rem] font-bold text-ink-500 mt-1">{scopeTask.title}</div>
              </div>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors leading-none" onClick={() => setScopeTask(null)}>×</button>
            </div>
            <div className="p-4 sm:p-5 space-y-5 flex-1 overflow-y-auto scroll-soft">
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
                  {/* Scope Tabs */}
                  <div className="flex border-b border-ink-150">
                    <button
                      type="button"
                      onClick={() => setScopeTab('groups')}
                      className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition-colors ${scopeTab === 'groups' ? 'border-brand text-brand' : 'border-transparent text-ink-500 hover:text-ink-900'}`}
                    >
                      الأسر والمجموعات ({groups.filter(g => {
                        const gStudents = students.filter(s => s.groupId === g.id && (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted'));
                        return gStudents.length > 0 && gStudents.every(s => scopeSelected.includes(s.id));
                      }).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeTab('students')}
                      className={`flex-1 pb-2.5 text-sm font-bold text-center border-b-2 transition-colors ${scopeTab === 'students' ? 'border-brand text-brand' : 'border-transparent text-ink-500 hover:text-ink-900'}`}
                    >
                      الطلاب الفرديون ({scopeSelected.length})
                    </button>
                  </div>

                  {scopeTab === 'groups' ? (
                    <div className="space-y-3">
                      <div className="text-xs text-ink-400 font-semibold">تحديد أسرة أو عدة أسر لاستهداف جميع طلابها دفعة واحدة:</div>
                      <div className="max-h-60 overflow-y-auto border border-ink-200 rounded-xl p-3 space-y-2 scroll-soft bg-ink-50/30">
                        {groups.map(group => {
                          const gStudents = students.filter(s => s.groupId === group.id && (s.registrationStatus === 'approved' || s.paymentStatus === 'exempted'));
                          if (gStudents.length === 0) return null;
                          const allChecked = gStudents.every(s => scopeSelected.includes(s.id));
                          const someChecked = gStudents.some(s => scopeSelected.includes(s.id)) && !allChecked;

                          return (
                            <label key={group.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer text-[0.85rem] transition-colors border border-transparent hover:border-ink-150 hover:shadow-sm">
                              <input
                                type="checkbox"
                                checked={allChecked}
                                ref={el => {
                                  if (el) el.indeterminate = someChecked;
                                }}
                                className="accent-brand w-4 h-4 cursor-pointer"
                                onChange={() => {
                                  const gStudentIds = gStudents.map(s => s.id);
                                  if (allChecked) {
                                    // Remove all
                                    setScopeSelected(prev => prev.filter(id => !gStudentIds.includes(id)));
                                  } else {
                                    // Add all
                                    setScopeSelected(prev => Array.from(new Set([...prev, ...gStudentIds])));
                                  }
                                }}
                              />
                              <span className="font-bold text-ink-800">
                                {group.name} 
                                <span className="text-ink-400 font-normal"> ({group.stage} - {gStudents.length} طلاب)</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                  
                  <div className="text-[0.85rem] text-brand-600 font-extrabold bg-brand-50 border border-brand-100 rounded-lg py-2 px-4 inline-block">
                    تم تحديد: {scopeSelected.length} طالب
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 sm:p-5 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl shrink-0">
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
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={() => setStatsTask(null)}>
          <div className="modal-panel w-[92vw] sm:w-full sm:max-w-lg rounded-2xl max-h-[78vh] flex flex-col shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-ink-900">إحصائيات تسليمات الطلاب</h3>
                <div className="text-[0.8rem] font-bold text-ink-500 mt-0.5">{statsTask.title}</div>
              </div>
              <button className="text-3xl text-ink-400 hover:text-ink-900 transition-colors leading-none" onClick={() => setStatsTask(null)}>×</button>
            </div>
            <div className="p-3.5 sm:p-4 space-y-3.5 flex-1 overflow-y-auto scroll-soft">
              {/* Stats Strip — order: awaiting review, submitted, rejected, not submitted */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-brand-50 p-2.5 rounded-xl border border-brand-100 shadow-sm">
                  <div className="text-2xl font-extrabold text-brand-600">{statsCounts.pending}</div>
                  <div className="text-[0.68rem] text-brand-700 font-bold mt-0.5">بانتظار المراجعة</div>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
                  <div className="text-2xl font-extrabold text-emerald-600">{statsCounts.submitted}</div>
                  <div className="text-[0.68rem] text-emerald-700 font-bold mt-0.5">تم التسليم</div>
                </div>
                <div className="bg-nred-50 p-2.5 rounded-xl border border-nred-100 shadow-sm">
                  <div className="text-2xl font-extrabold text-nred-600">{statsCounts.missing}</div>
                  <div className="text-[0.68rem] text-nred-700 font-bold mt-0.5">لم يسلموا</div>
                </div>
                <div className="bg-ink-50 p-2.5 rounded-xl border border-ink-150 shadow-sm">
                  <div className="text-2xl font-extrabold text-ink-800">{statsCounts.total}</div>
                  <div className="text-[0.68rem] text-ink-500 font-bold mt-0.5">إجمالي المستهدفين</div>
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

              {/* Student rows */}
              <div className="border border-ink-150 rounded-xl bg-white shadow-sm overflow-hidden">
                {statsStudentList.length === 0 ? (
                  <div className="text-center py-12 text-ink-400 font-medium text-[0.9rem]">لا يوجد طلاب يطابقون الفلاتر المحددة.</div>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {statsStudentList.map((item) => {
                      const status = item.submitted ? item.submission!.status : 'missing';
                      const isApproved = item.submission?.status === 'approved';
                      return (
                        <li key={item.id} className="flex items-center gap-3 p-3 hover:bg-cream-100/50 transition-colors">
                          {/* status dot (color only) */}
                          <span className={`w-3 h-3 rounded-full shrink-0 ${statusDotClass(status)}`} title={statusText(status)} />

                          {/* name + meta + date */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-ink-900 text-[0.85rem] truncate">{item.studentName}</p>
                            <p className="text-[0.7rem] text-ink-400 truncate">{item.stage} - {item.grade}</p>
                            <p className="text-[0.65rem] text-ink-400 font-mono mt-0.5">
                              {item.submission ? item.submission.submittedAt.split('T')[0] : '—'}
                            </p>
                          </div>

                          {/* grade */}
                          <div className="shrink-0 text-left">
                            {isApproved ? (
                              <span className="font-extrabold text-emerald-600 text-[0.95rem] whitespace-nowrap">{item.submission!.grade} 🎯</span>
                            ) : (
                              <span className="text-ink-300 text-sm">—</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div className="flex justify-end p-4 sm:p-5 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl shrink-0">
              <button onClick={() => setStatsTask(null)} className="btn bg-brand-500 hover:bg-brand-600 text-white text-[0.95rem] font-bold rounded-xl py-3 px-8 shadow-brand">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGE TRACKS */}
      {manageTracksOpen && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto" onClick={() => setManageTracksOpen(false)}>
          <div className="modal-panel w-[92vw] sm:w-full sm:max-w-md rounded-2xl max-h-[85vh] flex flex-col shadow-elevated" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-ink-150 bg-ink-50/50 rounded-t-2xl shrink-0">
              <h3 className="text-lg sm:text-xl font-extrabold text-ink-900">⚙️ إدارة وتعديل المسارات</h3>
              <button type="button" className="text-3xl text-ink-400 hover:text-ink-900 leading-none" onClick={() => setManageTracksOpen(false)}>×</button>
            </div>
            
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto scroll-soft space-y-4">
              {editingTrackIndex === null ? (
                // Track List View
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500 font-bold">المسارات الحالية ({tracks.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTrackIndex(-1);
                        setTrackFormName('');
                      }}
                      className="btn text-white bg-emerald-600 hover:bg-emerald-700 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm"
                    >
                      + إضافة مسار جديد
                    </button>
                  </div>

                  <div className="divide-y divide-ink-150 border border-ink-150 rounded-xl bg-white overflow-hidden shadow-soft">
                    {tracks.map((tr, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-ink-50/20">
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-[0.72rem] font-bold ${getTrackPillClass(tr.name)}`}>
                            {tr.name}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTrackIndex(idx);
                              setTrackFormName(tr.name);
                            }}
                            className="text-brand hover:bg-brand-50/50 border border-brand-200/50 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                          >
                            تعديل
                          </button>
                          {tr.name !== 'عام' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف مسار "${tr.name}"؟`)) {
                                  setTracks(prev => prev.filter((_, i) => i !== idx));
                                }
                              }}
                              className="text-nred-600 hover:bg-nred-50 border border-nred-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Track Add/Edit Form View
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-ink-150 pb-2">
                    <h4 className="text-sm font-bold text-ink-800">
                      {editingTrackIndex === -1 ? 'إضافة مسار جديد' : `تعديل مسار: ${tracks[editingTrackIndex]?.name}`}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingTrackIndex(null)}
                      className="text-xs text-ink-500 hover:underline"
                    >
                      ← العودة للقائمة
                    </button>
                  </div>

                  <div>
                    <label className="label font-bold text-ink-800 mb-1.5">اسم المسار <span className="req">*</span></label>
                    <input
                      type="text"
                      className="field py-3 rounded-xl bg-ink-50/30"
                      required
                      placeholder="مثال: مسار تقني..."
                      value={trackFormName}
                      onChange={e => setTrackFormName(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingTrackIndex(null)}
                      className="btn bg-white border border-ink-200 hover:bg-ink-50 text-ink-800 text-xs font-bold py-2 px-4 rounded-xl"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const name = trackFormName.trim();
                        if (!name) return pushToast('error', 'يرجى إدخال اسم المسار');
                        
                        // Check duplicate name (except current index)
                        const isDup = tracks.some((t, i) => t.name === name && i !== editingTrackIndex);
                        if (isDup) return pushToast('error', 'هناك مسار آخر بنفس الاسم');

                        if (editingTrackIndex === -1) {
                          // Add
                          setTracks(prev => [...prev, { name }]);
                        } else {
                          // Edit
                          setTracks(prev => prev.map((t, i) => i === editingTrackIndex ? { name } : t));
                        }
                        setEditingTrackIndex(null);
                      }}
                      className="btn bg-brand hover:bg-brand/90 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-soft"
                    >
                      حفظ المسار
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 sm:p-5 border-t border-ink-150 bg-ink-50/50 rounded-b-2xl shrink-0">
              <button
                type="button"
                onClick={() => setManageTracksOpen(false)}
                className="btn bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 transition-colors text-[0.95rem] font-bold rounded-xl py-3 px-6"
              >
                إلغاء
              </button>
              {editingTrackIndex === null && (
                <button
                  type="button"
                  disabled={saveTracksBusy}
                  onClick={async () => {
                    setSaveTracksBusy(true);
                    try {
                      const res = await fetch('/api/supervisor/tracks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tracks })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'فشل حفظ التغييرات');
                      pushToast('success', 'تم حفظ وتحديث المسارات بنجاح ✓');
                      setManageTracksOpen(false);
                      loadData();
                    } catch (err: any) {
                      pushToast('error', err.message || 'تعذر الاتصال بالخادم');
                    } finally {
                      setSaveTracksBusy(false);
                    }
                  }}
                  className="btn bg-emerald-600 hover:bg-emerald-700 border-transparent text-white text-[0.95rem] font-bold shadow-soft rounded-xl py-3 px-8"
                >
                  {saveTracksBusy ? 'جارٍ الحفظ…' : 'حفظ التغييرات النهائية ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* SUBMISSION CARD COMPONENT */
function SubmissionCard({
  sub, onEvaluate, supervisors, isLog = false, canGrade = true,
  inlineEditSub, inlinePoints, setInlineEditSub, setInlinePoints, saveInlinePoints, inlineBusy
}: any) {
  const isPending = sub.status === 'pending';
  const isApproved = sub.status === 'approved';
  const isRejected = sub.status === 'rejected';

  const borderColor = isPending ? 'border-brand-500' : isApproved ? 'border-emerald-500' : 'border-nred-500';
  const assignedLabel = sub.taskAssignedAdmins?.length === 0 ? 'جميع المشرفين' : sub.taskAssignedAdmins?.map((id: string) => supervisors.find((s: any) => String(s.id) === id)?.name).filter(Boolean).join('، ');

  return (
    <div className={`bg-white rounded-xl p-4 transition-all duration-200 hover:shadow-md border border-ink-150 border-r-4 ${borderColor} mb-3 shadow-sm`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Right Section: Avatar + Student & Task details */}
        <div className="flex items-center gap-3 min-w-[240px] max-w-full lg:max-w-[35%]">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 font-extrabold flex items-center justify-center text-lg shrink-0 border border-emerald-100 shadow-sm">
            {sub.studentName?.charAt(0) || 'ط'}
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-ink-900 text-[0.9rem] truncate">{sub.studentName}</h4>
            <div className="text-xs font-bold text-brand-600 truncate mt-0.5" title={sub.taskTitle}>{sub.taskTitle}</div>
          </div>
        </div>

        {/* Middle Section: Metadata, Track, Status, and Scores */}
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-ink-500 font-medium">
          <span className="font-mono bg-ink-50 px-2 py-0.5 rounded border border-ink-150 text-[0.7rem] font-bold" title="تاريخ التسليم">
            📅 {sub.submittedAt.split('T')[0]}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[0.65rem] ${getTrackPillClass(sub.taskTrack)}`}>
            {sub.taskTrack || 'عام'}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold shadow-sm ${isPending ? 'bg-brand-50 text-brand-700 border border-brand-200' : isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-nred-50 text-nred-700 border border-nred-200'}`}>
            {statusLabel(sub.status)}
          </span>
          {sub.wasLate && (
            <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold shadow-sm bg-yellow-50 text-yellow-800 border border-yellow-300">
              ⏰ متأخر
            </span>
          )}
          
          {/* Display grade or status */}
          {!isPending && isApproved && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-extrabold">
              النقاط: {sub.grade} / {sub.taskMaxPoints} 🎯
            </span>
          )}
          {!isPending && isRejected && (
            <span className="bg-nred-50 text-nred-700 border border-nred-200 px-2.5 py-0.5 rounded-lg font-extrabold">
              تم الرد ✗
            </span>
          )}

          {/* Inline Edit Points for approved submissions */}
          {!isPending && isApproved && inlineEditSub === sub.id && (
            <div className="flex items-center gap-1 bg-ink-50 p-1 rounded-lg border border-ink-200" onClick={e => e.stopPropagation()}>
              <input type="number" min={0} max={sub.taskMaxPoints} className="field py-0.5 px-2 w-16 text-center font-extrabold text-[0.8rem] text-brand-600 rounded border-brand-200 bg-white" value={inlinePoints} onChange={e => setInlinePoints?.(e.target.value.replace(/\D/g, ''))} />
              <button onClick={() => saveInlinePoints?.(sub)} disabled={inlineBusy} className="bg-brand text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm cursor-pointer hover:bg-brand/90">حفظ</button>
              <button onClick={() => setInlineEditSub?.(null)} className="bg-white border border-ink-200 text-ink-600 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm cursor-pointer hover:bg-ink-100">إلغاء</button>
            </div>
          )}
          {!isPending && isApproved && canGrade && inlineEditSub !== sub.id && (
            <button onClick={() => { setInlineEditSub?.(sub.id); setInlinePoints?.(String(sub.grade || 0)); }} className="text-brand hover:underline font-bold text-[0.7rem] mr-1 cursor-pointer">
              ✏️ تعديل النقاط
            </button>
          )}

          {/* Feedback comment placeholder if exists */}
          {sub.feedback && (
            <span className="text-[0.7rem] text-ink-500 bg-ink-50 px-2 py-0.5 rounded border border-ink-150 max-w-[150px] truncate" title={sub.feedback}>
              💬 {sub.feedback}
            </span>
          )}
        </div>

        {/* Left Section: File Link & Main Action Button */}
        <div className="flex items-center gap-2 justify-end self-end lg:self-auto shrink-0">
          {sub.fileUrl && sub.fileUrl !== 'admin://manual-mark' && (
            <a 
              href={sub.fileUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand bg-brand-50 hover:bg-brand-100 border border-brand-200/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer"
            >
              📄 الملف
            </a>
          )}
          
          {isPending && onEvaluate && (
            <button onClick={() => onEvaluate(sub)} className="btn bg-brand-500 hover:bg-brand-600 text-white font-bold py-1.5 px-4 rounded-lg text-xs shadow-brand transition-colors whitespace-nowrap cursor-pointer">
              مراجعة وتقييم
            </button>
          )}
          {!isPending && onEvaluate && (
            <button onClick={() => onEvaluate(sub)} className="text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer">
              عرض التفاصيل
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
