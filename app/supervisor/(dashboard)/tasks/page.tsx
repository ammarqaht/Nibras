'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';

type SupervisorUser = { id: number; name: string; email: string; role?: string };
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
  cost: number;
  durationHours: number | null;
  isActive: boolean;
  submissionMethod: string | null;
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
  submittedAt: string;
  studentName: string;
  taskTitle: string;
  taskMaxPoints: number;
  taskTrack: string | null;
  taskAssignedAdmins: string[];
};
type Student = { id: number; membershipNo: number; studentName: string; stage: string; grade: string; registrationStatus: string; paymentStatus: string };

function statusLabel(s: string) {
  if (s === 'approved') return 'مقبولة ✓';
  if (s === 'rejected') return 'مردودة ✗';
  return 'بانتظار المراجعة';
}
function statusBadgeClass(s: string) {
  if (s === 'approved') return 'pill-green';
  if (s === 'rejected') return 'pill-red';
  return 'pill-yellow';
}

const STAGE_OPTIONS = ['ابتدائي', 'متوسط', 'ثانوي'];

// A student is "targeted" by a task only if they pass both the visibility (restricted) and stage filters
function isTaskTargeted(
  s: { id: number; stage: string },
  task: { visibility: string; visibleToIds: number[]; stage: string | null },
) {
  if (task.visibility === 'restricted' && !task.visibleToIds.includes(s.id)) return false;
  if (task.stage && task.stage !== 'الكل' && s.stage !== task.stage) return false;
  return true;
}

const SUBMISSION_METHODS: { value: string; label: string }[] = [
  { value: 'file',  label: 'رفع ملف (صورة / مستند / فيديو)' },
  { value: 'audio', label: 'تسجيل صوتي' },
  { value: 'text',  label: 'إجابة نصية' },
  { value: 'ack',   label: 'إقرار بالإنجاز فقط' },
];
// Map legacy Arabic values + new keys to a canonical method key
function methodKey(m: string | null): string {
  switch (m) {
    case 'file': case 'رفع ملف': case 'image': case 'video': case 'any': return 'file';
    case 'audio': return 'audio';
    case 'text': return 'text';
    case 'ack': case 'إقرار بالإنجاز': return 'ack';
    default: return 'file';
  }
}
// Renders whatever the student submitted: image, audio, text, acknowledgment, or a file link
function SubmissionContent({ fileUrl }: { fileUrl: string }) {
  if (!fileUrl) return <span className="text-xs text-ink-400">—</span>;
  if (fileUrl.startsWith('data:image')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fileUrl} alt="إثبات" className="max-h-56 rounded-lg border border-ink-200 mx-auto cursor-zoom-in" onClick={() => window.open(fileUrl, '_blank')} />;
  }
  if (fileUrl.startsWith('data:audio') || fileUrl.startsWith('data:video/webm')) {
    return <audio controls src={fileUrl} className="w-full" />;
  }
  if (fileUrl.startsWith('text:')) {
    return <div className="whitespace-pre-wrap text-sm bg-cream-50 p-3 rounded-lg border border-ink-150 text-ink-800">{fileUrl.slice(5)}</div>;
  }
  if (fileUrl === 'admin://manual-mark' || fileUrl.startsWith('ack://')) {
    return <div className="text-sm text-ink-700 inline-flex items-center gap-1.5"><span className="text-green-600">✓</span> إقرار بالإنجاز من الطالب</div>;
  }
  return <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3">فتح الملف المرفق</a>;
}

export default function TasksPage() {
  const { user } = useSupervisor();

  const roles = useMemo(() => (user?.role || '').split(',').map(r => r.trim()), [user]);
  const isScientific = roles.includes('scientific_supervisor') || roles.includes('admin');

  type Tab = 'submissions' | 'log' | 'add' | 'manage';
  const [activeTab, setActiveTab] = useState<Tab>('submissions');
  const [loading, setLoading] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<string[]>(['عام']);
  const [newCategory, setNewCategory] = useState('');
  const [savingCats, setSavingCats] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<{ original: string; value: string } | null>(null);

  // Filters
  const [subSearch, setSubSearch] = useState('');
  const [subTaskFilter, setSubTaskFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logTaskFilter, setLogTaskFilter] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [manageSearch, setManageSearch] = useState('');
  const [manageTrack, setManageTrack] = useState('');
  const [manageStage, setManageStage] = useState('');
  const [manageMethod, setManageMethod] = useState('');
  const [manageStatus, setManageStatus] = useState('');

  // Eval modal
  const [evalSub, setEvalSub] = useState<Submission | null>(null);
  const [evalPoints, setEvalPoints] = useState('');
  const [evalComment, setEvalComment] = useState('');
  const [evalBusy, setEvalBusy] = useState(false);

  // Edit task modal
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  // Scope modal
  const [scopeTask, setScopeTask] = useState<Task | null>(null);
  const [scopeSearch, setScopeSearch] = useState('');
  const [scopeSelected, setScopeSelected] = useState<number[]>([]);
  const [scopeBusy, setScopeBusy] = useState(false);

  // Stats modal
  const [statsTask, setStatsTask] = useState<Task | null>(null);
  const [statsSearch, setStatsSearch] = useState('');
  const [statsFilter, setStatsFilter] = useState<'all' | 'submitted' | 'missing'>('all');

  // Add task form
  const addFileRef = useRef<HTMLInputElement>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addPoints, setAddPoints] = useState('10');
  const [addStartDate, setAddStartDate] = useState('');
  const [addDeadline, setAddDeadline] = useState('');
  const [addTrack, setAddTrack] = useState('عام');
  const [addStage, setAddStage] = useState('');
  const [addCost, setAddCost] = useState('0');
  const [addDuration, setAddDuration] = useState('');
  const [addMethod, setAddMethod] = useState('file');
  const [addResourceLink, setAddResourceLink] = useState('');
  const [addImage, setAddImage] = useState<string | null>(null);
  const [addAdmins, setAddAdmins] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);

  // Inline points edit in log
  const [inlineEditSub, setInlineEditSub] = useState<string | null>(null);
  const [inlinePoints, setInlinePoints] = useState('');
  const [inlineBusy, setInlineBusy] = useState(false);

  // Accordion: which log card is expanded (only one at a time)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  async function loadData() {
    try {
      const [studentsRes, supervisorsRes, tasksRes, submissionsRes] = await Promise.all([
        fetch('/api/supervisor/students', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks/supervisors', { cache: 'no-store' }),
        fetch('/api/supervisor/tasks', { cache: 'no-store' }),
        fetch('/api/supervisor/submissions', { cache: 'no-store' }),
      ]);
      const studentsData = await studentsRes.json().catch(() => ({ students: [] }));
      const supervisorsData = await supervisorsRes.json().catch(() => ({ supervisors: [] }));
      const tasksData = await tasksRes.json().catch(() => ({ tasks: [], categories: [] }));
      const submissionsData = await submissionsRes.json().catch(() => ({ submissions: [] }));

      setStudents(studentsData.students ?? []);
      setSupervisors(supervisorsData.supervisors ?? []);
      setTasks(tasksData.tasks ?? []);
      setSubmissions(submissionsData.submissions ?? []);
      if (Array.isArray(tasksData.categories) && tasksData.categories.length > 0) {
        setCategories(tasksData.categories);
      }
    } catch {
      pushToast('error', 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // For tasks_supervisor: tasks already pre-filtered by API; submissions filtered to match
  const visibleSubmissions = useMemo(() => {
    if (isScientific) return submissions;
    const myTaskIds = new Set(tasks.map(t => t.id));
    return submissions.filter(s => myTaskIds.has(s.taskId));
  }, [submissions, tasks, isScientific]);

  const pendingSubmissions = useMemo(() => visibleSubmissions.filter(s => s.status === 'pending'), [visibleSubmissions]);
  // Only finished evaluations belong in the log (exclude claimed / cancelled / expired)
  const logSubmissions = useMemo(() => visibleSubmissions.filter(s => s.status === 'approved' || s.status === 'rejected'), [visibleSubmissions]);

  const filteredPending = useMemo(() => pendingSubmissions.filter(s => {
    const q = subSearch.trim().toLowerCase();
    return (!q || s.studentName.toLowerCase().includes(q)) && (!subTaskFilter || s.taskId === subTaskFilter);
  }), [pendingSubmissions, subSearch, subTaskFilter]);

  const filteredLog = useMemo(() => logSubmissions.filter(s => {
    const q = logSearch.trim().toLowerCase();
    return (!q || s.studentName.toLowerCase().includes(q))
      && (!logTaskFilter || s.taskId === logTaskFilter)
      && (!logStatusFilter || s.status === logStatusFilter);
  }), [logSubmissions, logSearch, logTaskFilter, logStatusFilter]);

  const filteredTasks = useMemo(() => tasks.filter(t =>
    (!manageSearch.trim() || t.title.toLowerCase().includes(manageSearch.trim().toLowerCase())) &&
    (!manageTrack || (t.track || 'عام') === manageTrack) &&
    (!manageStage || (t.stage || 'الكل') === manageStage) &&
    (!manageMethod || methodKey(t.submissionMethod) === manageMethod) &&
    (!manageStatus || (manageStatus === 'active' ? t.isActive : !t.isActive))
  ), [tasks, manageSearch, manageTrack, manageStage, manageMethod, manageStatus]);

  const uniqueTasksPending = useMemo(() => {
    const ids = new Set(pendingSubmissions.map(s => s.taskId));
    return tasks.filter(t => ids.has(t.id));
  }, [tasks, pendingSubmissions]);

  const uniqueTasksLog = useMemo(() => {
    const ids = new Set(logSubmissions.map(s => s.taskId));
    return tasks.filter(t => ids.has(t.id));
  }, [tasks, logSubmissions]);

  // Stats modal data
  const statsStudentList = useMemo(() => {
    if (!statsTask) return [];
    const active = students.filter(s => s.registrationStatus === 'approved');
    const scoped = active.filter(s => isTaskTargeted(s, statsTask));
    const subMap = new Map(submissions.filter(s => s.taskId === statsTask.id && ['pending', 'approved', 'rejected'].includes(s.status)).map(s => [s.registrationId, s]));
    let list = scoped.map(st => ({ ...st, submitted: subMap.has(st.id), submission: subMap.get(st.id) || null }));
    const q = statsSearch.trim().toLowerCase();
    if (q) list = list.filter(i => i.studentName.toLowerCase().includes(q));
    if (statsFilter === 'submitted') list = list.filter(i => i.submitted);
    if (statsFilter === 'missing') list = list.filter(i => !i.submitted);
    return list;
  }, [statsTask, students, submissions, statsSearch, statsFilter]);

  const statsCounts = useMemo(() => {
    if (!statsTask) return { total: 0, submitted: 0, missing: 0, pending: 0 };
    const active = students.filter(s => s.registrationStatus === 'approved');
    const scoped = active.filter(s => isTaskTargeted(s, statsTask));
    const taskSubs = submissions.filter(s => s.taskId === statsTask.id && ['pending', 'approved', 'rejected'].includes(s.status));
    const submittedIds = new Set(taskSubs.map(s => s.registrationId));
    const total = scoped.length;
    const submitted = scoped.filter(s => submittedIds.has(s.id)).length;
    return { total, submitted, missing: total - submitted, pending: taskSubs.filter(s => s.status === 'pending').length };
  }, [statsTask, students, submissions]);

  // Handlers
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addDesc.trim() || !addDeadline) return pushToast('error', 'يرجى إدخال جميع الحقول الإلزامية');
    setAddBusy(true);
    try {
      const res = await fetch('/api/supervisor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle.trim(), description: addDesc.trim(),
          maxPoints: parseInt(addPoints, 10),
          startDate: addStartDate || null,
          dueDate: addDeadline, track: addTrack, stage: addStage || null,
          cost: parseInt(addCost, 10) || 0,
          durationHours: addDuration ? parseInt(addDuration, 10) || null : null,
          submissionMethod: addMethod,
          assignedAdmins: addAdmins, imageUrl: addImage,
          resourceLink: addResourceLink.trim() || null,
          visibility: 'all', visibleToIds: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المهمة');
      pushToast('success', 'تم نشر المهمة بنجاح ✓');
      setAddTitle(''); setAddDesc(''); setAddPoints('10');
      setAddStartDate(''); setAddDeadline(''); setAddTrack('عام'); setAddStage('');
      setAddCost('0'); setAddDuration('');
      setAddMethod('file'); setAddResourceLink('');
      setAddImage(null); setAddAdmins([]);
      await loadData();
      setActiveTab('manage');
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleEvaluate(status: 'approved' | 'rejected') {
    if (!evalSub) return;
    const grade = parseInt(evalPoints === '' ? String(evalSub.taskMaxPoints) : evalPoints, 10);
    if (status === 'approved' && (isNaN(grade) || grade < 0 || grade > evalSub.taskMaxPoints)) {
      return pushToast('error', `يجب أن تكون الدرجة بين 0 و ${evalSub.taskMaxPoints}`);
    }
    if (status === 'rejected' && !evalComment.trim()) {
      return pushToast('error', 'يجب كتابة سبب رد المهمة في خانة التعليق');
    }
    setEvalBusy(true);
    try {
      const res = await fetch(`/api/supervisor/submissions/${evalSub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, grade: status === 'approved' ? grade : 0, feedback: evalComment.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التقييم');
      pushToast('success', status === 'approved' ? 'تم قبول التسليم ✓' : 'تم رد المهمة ✗');
      setEvalSub(null); setEvalPoints(''); setEvalComment('');
      loadData();
    } catch (err: any) {
      pushToast('error', err.message);
    } finally {
      setEvalBusy(false);
    }
  }

  async function toggleTaskActive(task: Task) {
    try {
      const res = await fetch(`/api/supervisor/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !task.isActive }),
      });
      if (!res.ok) throw new Error('فشل تغيير الحالة');
      pushToast('info', task.isActive ? 'تم تعطيل المهمة' : 'تم تفعيل المهمة');
      loadData();
    } catch (err: any) { pushToast('error', err.message); }
  }

  async function handleTaskDelete(id: string, title: string) {
    if (!confirm(`حذف المهمة "${title}" نهائياً؟`)) return;
    try {
      const res = await fetch(`/api/supervisor/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل الحذف');
      pushToast('info', 'تم حذف المهمة');
      loadData();
    } catch (err: any) { pushToast('error', err.message); }
  }

  async function handleUpdateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditBusy(true);
    try {
      const res = await fetch(`/api/supervisor/tasks/${editTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTask.title, description: editTask.description,
          maxPoints: editTask.maxPoints,
          startDate: editTask.startDate || null,
          dueDate: editTask.dueDate,
          track: editTask.track,
          stage: editTask.stage || null,
          cost: editTask.cost ?? 0,
          durationHours: editTask.durationHours ?? null,
          submissionMethod: editTask.submissionMethod,
          assignedAdmins: editTask.assignedAdmins,
          imageUrl: editTask.imageUrl,
          resourceLink: editTask.resourceLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحديث');
      pushToast('success', 'تم حفظ التعديلات ✓');
      setEditTask(null);
      loadData();
    } catch (err: any) { pushToast('error', err.message); }
    finally { setEditBusy(false); }
  }

  async function handleScopeConfirm() {
    if (!scopeTask) return;
    setScopeBusy(true);
    try {
      const res = await fetch(`/api/supervisor/tasks/${scopeTask.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: scopeTask.visibility, visibleToIds: scopeTask.visibility === 'restricted' ? scopeSelected : [] }),
      });
      if (!res.ok) throw new Error('فشل تحديث النطاق');
      pushToast('success', 'تم تحديث نطاق المهمة ✓');
      setScopeTask(null);
      loadData();
    } catch (err: any) { pushToast('error', err.message); }
    finally { setScopeBusy(false); }
  }

  async function saveInlinePoints(sub: Submission) {
    const val = parseInt(inlinePoints, 10);
    if (isNaN(val) || val < 0 || val > sub.taskMaxPoints) return pushToast('error', `يجب أن تكون الدرجة بين 0 و ${sub.taskMaxPoints}`);
    setInlineBusy(true);
    try {
      const res = await fetch(`/api/supervisor/submissions/${sub.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: val }),
      });
      if (!res.ok) throw new Error('فشل التعديل');
      pushToast('success', 'تم تعديل الدرجة ✓');
      setInlineEditSub(null);
      loadData();
    } catch { pushToast('error', 'فشل تعديل الدرجة'); }
    finally { setInlineBusy(false); }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 100);
      if (isEdit && editTask) setEditTask({ ...editTask, imageUrl: base64 });
      else setAddImage(base64);
      pushToast('info', 'تم تحميل الصورة ✓');
    } catch { pushToast('error', 'تعذر معالجة الصورة'); }
  }

  const toggleAdminChip = (id: string, isEdit = false) => {
    if (isEdit && editTask) {
      const next = editTask.assignedAdmins.includes(id) ? editTask.assignedAdmins.filter(x => x !== id) : [...editTask.assignedAdmins, id];
      setEditTask({ ...editTask, assignedAdmins: next });
    } else {
      setAddAdmins(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }
  };

  async function saveCategories(cats: string[]) {
    setSavingCats(true);
    try {
      await fetch('/api/supervisor/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_categories', categories: cats }),
      });
      setCategories(cats);
    } catch { pushToast('error', 'فشل حفظ التصنيفات'); }
    finally { setSavingCats(false); }
  }

  function addCategory() {
    const cat = newCategory.trim();
    if (!cat) return;
    if (categories.includes(cat)) { pushToast('error', 'التصنيف موجود مسبقاً'); return; }
    saveCategories([...categories, cat]);
    setNewCategory('');
  }

  function removeCategory(cat: string) {
    if (cat === 'عام') return;
    saveCategories(categories.filter(c => c !== cat));
    if (addTrack === cat) setAddTrack('عام');
  }

  function commitRename() {
    if (!editingCat) return;
    const next = editingCat.value.trim();
    const original = editingCat.original;
    if (!next || next === original) { setEditingCat(null); return; }
    if (categories.includes(next)) { pushToast('error', 'التصنيف موجود مسبقاً'); return; }
    saveCategories(categories.map(c => (c === original ? next : c)));
    if (addTrack === original) setAddTrack(next);
    setEditingCat(null);
  }

  if (loading) return <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل البيانات…</div>;

  return (
    <div dir="rtl" className="w-full">
      <div className="mb-6 flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-sm" style={{ background: 'linear-gradient(135deg,#FF9F1C,#F4720B)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-0.5">
            {isScientific ? 'إدارة المهام والتحديات' : 'مهامي المُكلَّف بها'}
          </h1>
          <p className="text-sm text-ink-500">
            {isScientific ? 'أنشئ المهام وكلّف المشرفين بمراجعتها وتتبع تسليمات الطلاب.' : 'راجع تسليمات الطلاب للمهام المُسنَدة إليك وقيّمها.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-ink-200 pb-2 overflow-x-auto scroll-soft">
        <TabBtn active={activeTab === 'submissions'} onClick={() => setActiveTab('submissions')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12M17 8l-5-5-5 5" />
          </svg>
          <span>المهام المسلمة</span>
          {pendingSubmissions.length > 0 && (
            <span className="mr-1.5 px-2 py-0.5 rounded-full bg-nred-600 text-white text-xs font-mono">{pendingSubmissions.length}</span>
          )}
        </TabBtn>
        <TabBtn active={activeTab === 'log'} onClick={() => setActiveTab('log')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>سجل التقييمات</span>
        </TabBtn>
        {isScientific && (
          <>
            <TabBtn active={activeTab === 'add'} onClick={() => setActiveTab('add')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
              </svg>
              <span>إضافة مهمة</span>
            </TabBtn>
            <TabBtn active={activeTab === 'manage'} onClick={() => setActiveTab('manage')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>إدارة المهام</span>
            </TabBtn>
          </>
        )}
      </div>

      {/* TAB: PENDING SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className="space-y-4 fade-in">
          {pendingSubmissions.length > 0 && (
            <div className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">البحث عن طالب</label>
                <input type="text" className="field py-1.5 px-3 text-sm" placeholder="ابحث باسم الطالب..." value={subSearch} onChange={e => setSubSearch(e.target.value)} />
              </div>
              <div>
                <label className="label">تصفية حسب المهمة</label>
                <select className="field py-1.5 px-3 text-sm" value={subTaskFilter} onChange={e => setSubTaskFilter(e.target.value)}>
                  <option value="">كل المهام</option>
                  {uniqueTasksPending.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
            </div>
          )}
          {filteredPending.length === 0 ? (
            <div className="card text-center p-12 space-y-3">
              <div className="text-3xl">🎉</div>
              <h3 className="font-bold text-lg text-ink-900">لا توجد تسليمات معلقة</h3>
              <p className="text-sm text-ink-500">{pendingSubmissions.length > 0 ? 'لا نتائج تطابق الفلاتر.' : 'تم تقييم جميع التسليمات.'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPending.map(sub => (
                <SubmissionCard key={sub.id} sub={sub} supervisors={supervisors} onEvaluate={setEvalSub} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: EVALUATION LOG */}
      {activeTab === 'log' && (
        <div className="space-y-4 fade-in">
          {logSubmissions.length > 0 && (
            <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">اسم الطالب</label>
                <input type="text" className="field py-1.5 px-3 text-sm" placeholder="ابحث..." value={logSearch} onChange={e => setLogSearch(e.target.value)} />
              </div>
              <div>
                <label className="label">المهمة</label>
                <select className="field py-1.5 px-3 text-sm" value={logTaskFilter} onChange={e => setLogTaskFilter(e.target.value)}>
                  <option value="">كل المهام</option>
                  {uniqueTasksLog.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="label">الحالة</label>
                <select className="field py-1.5 px-3 text-sm" value={logStatusFilter} onChange={e => setLogStatusFilter(e.target.value)}>
                  <option value="">كل الحالات</option>
                  <option value="approved">مقبولة</option>
                  <option value="rejected">مردودة</option>
                </select>
              </div>
            </div>
          )}
          {filteredLog.length === 0 ? (
            <div className="card text-center p-12 text-ink-400">لا توجد تقييمات مسجلة بعد.</div>
          ) : (
            <div className="space-y-4">
              {filteredLog.map(sub => (
                <SubmissionCard
                  key={sub.id} sub={sub} supervisors={supervisors} isLog
                  collapsible expanded={expandedLogId === sub.id}
                  onToggle={() => setExpandedLogId(id => (id === sub.id ? null : sub.id))}
                  inlineEditSub={inlineEditSub} inlinePoints={inlinePoints}
                  setInlineEditSub={setInlineEditSub} setInlinePoints={setInlinePoints}
                  saveInlinePoints={saveInlinePoints} inlineBusy={inlineBusy}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: ADD TASK (scientific only) */}
      {activeTab === 'add' && isScientific && (
        <div className="max-w-2xl mx-auto fade-in space-y-4">
          <form onSubmit={handleAddTask} className="card p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink-900 border-b border-ink-150 pb-2 mb-4">إنشاء مهمة جديدة</h2>

            <div>
              <label className="label">عنوان المهمة <span className="req">*</span></label>
              <input type="text" className="field" required placeholder="مثال: حفظ سورة الملك…" value={addTitle} onChange={e => setAddTitle(e.target.value)} />
            </div>

            <div>
              <label className="label">وصف المهمة <span className="req">*</span></label>
              <textarea className="field" required rows={4} placeholder="اكتب تفاصيل وشروط المهمة…" value={addDesc} onChange={e => setAddDesc(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">نقاط الإنجاز <span className="req">*</span></label>
                <input type="number" className="field text-center" required min={1} value={addPoints} onChange={e => setAddPoints(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="label">التصنيف</label>
                <select className="field" value={addTrack} onChange={e => setAddTrack(e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">موعد البداية</label>
                <input type="date" className="field" value={addStartDate} onChange={e => setAddStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">الموعد النهائي <span className="req">*</span></label>
                <input type="date" className="field" required value={addDeadline} onChange={e => setAddDeadline(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">المرحلة المعنية <span className="req">*</span></label>
                <select className="field" value={addStage} onChange={e => setAddStage(e.target.value)}>
                  <option value="">جميع المراحل</option>
                  {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">طريقة التسليم <span className="req">*</span></label>
                <select className="field" value={addMethod} onChange={e => setAddMethod(e.target.value)}>
                  {SUBMISSION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">مبلغ المهمة (يُخصم من رصيد الطالب عند الطلب)</label>
                <input type="number" className="field text-center" min={0} value={addCost} onChange={e => setAddCost(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label className="label">مهلة الإنجاز بالساعات (اختياري)</label>
                <input type="number" className="field text-center" min={0} placeholder="مثال: 48" value={addDuration} onChange={e => setAddDuration(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>

            <div>
              <label className="label">صورة توضيحية (اختياري)</label>
              <div onClick={() => addFileRef.current?.click()} className="border-2 border-dashed border-ink-300 rounded-xl p-4 text-center cursor-pointer hover:bg-cream-100/50">
                <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, false)} />
                {addImage ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={addImage} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                    <button type="button" className="btn btn-secondary text-xs" onClick={ev => { ev.stopPropagation(); setAddImage(null); }}>إزالة</button>
                  </div>
                ) : (
                  <div className="py-2 text-ink-400 text-sm">اضغط لاختيار صورة</div>
                )}
              </div>
            </div>

            <div>
              <label className="label">رابط مرجعي (اختياري)</label>
              <input type="url" className="field" placeholder="https://example.com/resource" value={addResourceLink} onChange={e => setAddResourceLink(e.target.value)} />
            </div>

            <div>
              <label className="label">المشرف المسؤول عن التقييم</label>
              <p className="text-xs text-ink-400 mb-2">عدم التحديد = جميع مشرفي المهام والعلمية.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setAddAdmins([])} className={`choice text-xs py-1 px-3 ${addAdmins.length === 0 ? 'is-active' : ''}`}>الجميع</button>
                {supervisors.map(s => (
                  <button key={s.id} type="button" onClick={() => toggleAdminChip(String(s.id), false)} className={`choice text-xs py-1 px-3 ${addAdmins.includes(String(s.id)) ? 'is-active' : ''}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={addBusy} className="btn btn-primary w-full py-2.5 font-bold">
              {addBusy ? 'جارٍ النشر…' : 'نشر المهمة للطلاب'}
            </button>
          </form>
        </div>
      )}

      {/* TAB: MANAGE TASKS (scientific only) */}
      {activeTab === 'manage' && isScientific && (
        <div className="space-y-4 fade-in">
          <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 sm:w-80">
              <input type="text" placeholder="ابحث في المهام…" className="field py-1.5 pr-9 pl-3 text-sm w-full" value={manageSearch} onChange={e => setManageSearch(e.target.value)} />
              <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5" onClick={() => { setShowCatModal(true); setEditingCat(null); setNewCategory(''); }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>إدارة التصنيفات</span>
              </button>
              <div className="text-xs text-ink-400 whitespace-nowrap">إجمالي: {filteredTasks.length} من {tasks.length}</div>
            </div>
          </div>

          <div className="card p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className="field py-1.5 px-3 text-sm" value={manageTrack} onChange={e => setManageTrack(e.target.value)}>
              <option value="">كل التصنيفات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="field py-1.5 px-3 text-sm" value={manageStage} onChange={e => setManageStage(e.target.value)}>
              <option value="">كل المراحل</option>
              <option value="الكل">الكل</option>
              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="field py-1.5 px-3 text-sm" value={manageMethod} onChange={e => setManageMethod(e.target.value)}>
              <option value="">كل طرق التسليم</option>
              {SUBMISSION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="field py-1.5 px-3 text-sm" value={manageStatus} onChange={e => setManageStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="active">نشطة</option>
              <option value="disabled">معطلة</option>
            </select>
          </div>

          <div className="card p-0 overflow-hidden">
            {filteredTasks.length === 0 ? (
              <p className="text-center py-12 text-ink-400 text-sm">لا توجد مهام.</p>
            ) : (
              <div className="overflow-x-auto scroll-soft">
                <table className="tbl text-right">
                  <thead>
                    <tr>
                      <th>المهمة</th>
                      <th>التصنيف</th>
                      <th>المرحلة</th>
                      <th>النقاط</th>
                      <th>البداية</th>
                      <th>الاستحقاق</th>
                      <th>الحالة</th>
                      <th className="text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => (
                      <tr key={task.id} className={!task.isActive ? 'opacity-60 bg-ink-50/20' : ''}>
                        <td className="max-w-xs">
                          <div className="font-semibold text-ink-900">{task.title}</div>
                          <div className="text-xs text-ink-400 truncate">{task.description}</div>
                        </td>
                        <td><span className="pill pill-gray text-xs">{task.track || 'عام'}</span></td>
                        <td className="text-xs text-ink-500">{task.stage || 'الكل'}</td>
                        <td className="font-bold text-brand-600">{task.maxPoints} ن</td>
                        <td className="text-xs font-mono text-ink-500">{task.startDate ? task.startDate.split('T')[0] : '—'}</td>
                        <td className="text-sm font-mono">{task.dueDate.split('T')[0]}</td>
                        <td><span className={`pill ${task.isActive ? 'pill-green' : 'pill-red'}`}>{task.isActive ? 'نشطة' : 'معطلة'}</span></td>
                        <td>
                          <div className="flex gap-1 justify-center">
                            <button className="btn btn-secondary py-1 px-2.5 text-xs" onClick={() => setEditTask(task)}>تعديل</button>
                            <button className={`btn py-1 px-2.5 text-xs ${task.isActive ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleTaskActive(task)}>
                              {task.isActive ? 'تعطيل' : 'تفعيل'}
                            </button>
                            <button className="btn btn-secondary py-1 px-2.5 text-xs" onClick={() => { setScopeTask(task); setScopeSelected(task.visibleToIds || []); setScopeSearch(''); }}>النطاق</button>
                            <button className="btn btn-secondary py-1 px-2.5 text-xs" onClick={() => { setStatsTask(task); setStatsSearch(''); setStatsFilter('all'); }}>إحصائيات</button>
                            <button className="text-nred-600 hover:text-nred-800 text-lg px-2" onClick={() => handleTaskDelete(task.id, task.title)}>×</button>
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

      {/* MODAL: EVALUATE SUBMISSION */}
      {evalSub && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEvalSub(null)}>
          <div className="modal-panel w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <h3 className="text-lg font-bold text-ink-900">مراجعة وتقييم المهمة</h3>
              <button className="text-2xl text-ink-400" onClick={() => setEvalSub(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-cream-50 p-3 rounded-lg border border-ink-150 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-ink-400">الطالب:</div>
                  <div className="font-bold text-ink-900 text-sm">{evalSub.studentName}</div>
                  <div className="text-sm font-semibold text-brand-600 mt-1">{evalSub.taskTitle}</div>
                </div>
                {evalSub.taskTrack && <span className="pill pill-gray text-xs shrink-0">{evalSub.taskTrack}</span>}
              </div>

              <div>
                <div className="label">ما سلّمه الطالب:</div>
                <SubmissionContent fileUrl={evalSub.fileUrl} />
              </div>

              <div>
                <label className="label">النقاط الممنوحة (الحد الأقصى: {evalSub.taskMaxPoints})</label>
                <div className="flex items-center gap-3">
                  <input type="number" min={0} max={evalSub.taskMaxPoints} className="field w-24 text-center font-bold text-lg"
                    value={evalPoints === '' ? evalSub.taskMaxPoints : evalPoints}
                    onChange={e => setEvalPoints(e.target.value.replace(/\D/g, ''))} />
                  <div className="flex-1 flex gap-1">
                    {([['كامل', evalSub.taskMaxPoints], ['75%', Math.round(evalSub.taskMaxPoints * 0.75)], ['50%', Math.round(evalSub.taskMaxPoints * 0.5)], ['صفر', 0]] as [string, number][]).map(([l, v]) => (
                      <button key={l} type="button" onClick={() => setEvalPoints(String(v))} className="btn btn-secondary text-xs flex-1">{l}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: '#EDEAE3' }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.min(100, Math.round(((evalPoints === '' ? evalSub.taskMaxPoints : (parseInt(evalPoints, 10) || 0)) / Math.max(1, evalSub.taskMaxPoints)) * 100))}%`,
                    background: 'linear-gradient(90deg,#34d399,#16a34a)',
                  }} />
                </div>
              </div>

              <div>
                <label className="label">تعليق للطالب <span className="text-ink-400 text-xs font-normal">(مطلوب عند رد المهمة)</span></label>
                <textarea className="field" rows={2} placeholder="مثال: أحسنت، استمر في التميز! — أو سبب الرد." value={evalComment} onChange={e => setEvalComment(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
              <button onClick={() => handleEvaluate('rejected')} disabled={evalBusy} className="btn btn-danger text-sm">رد المهمة</button>
              <button onClick={() => handleEvaluate('approved')} disabled={evalBusy} className="btn btn-primary text-sm font-bold">
                {evalBusy ? 'جارٍ الحفظ…' : 'اعتماد وحفظ النقاط'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TASK */}
      {editTask && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEditTask(null)}>
          <div className="modal-panel w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateTask}>
              <div className="flex items-center justify-between p-5 border-b border-ink-200">
                <h3 className="text-lg font-bold text-ink-900">تعديل المهمة</h3>
                <button type="button" className="text-2xl text-ink-400" onClick={() => setEditTask(null)}>×</button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scroll-soft">
                <div>
                  <label className="label">العنوان</label>
                  <input type="text" className="field" required value={editTask.title} onChange={e => setEditTask({ ...editTask, title: e.target.value })} />
                </div>
                <div>
                  <label className="label">الوصف</label>
                  <textarea className="field" required rows={4} value={editTask.description} onChange={e => setEditTask({ ...editTask, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="label">النقاط</label>
                    <input type="number" className="field text-center" required min={1} value={editTask.maxPoints} onChange={e => setEditTask({ ...editTask, maxPoints: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className="label">التصنيف</label>
                    <select className="field" value={editTask.track || 'عام'} onChange={e => setEditTask({ ...editTask, track: e.target.value })}>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">موعد البداية</label>
                    <input type="date" className="field" value={editTask.startDate?.split('T')[0] || ''} onChange={e => setEditTask({ ...editTask, startDate: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="label">الموعد النهائي</label>
                    <input type="date" className="field" required value={editTask.dueDate.split('T')[0]} onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">المرحلة المعنية</label>
                    <select className="field" value={editTask.stage || ''} onChange={e => setEditTask({ ...editTask, stage: e.target.value || null })}>
                      <option value="">جميع المراحل</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">طريقة التسليم</label>
                    <select className="field" value={methodKey(editTask.submissionMethod)} onChange={e => setEditTask({ ...editTask, submissionMethod: e.target.value })}>
                      {SUBMISSION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">مبلغ المهمة (يُخصم عند الطلب)</label>
                    <input type="number" className="field text-center" min={0} value={editTask.cost ?? 0} onChange={e => setEditTask({ ...editTask, cost: parseInt(e.target.value, 10) || 0 })} />
                  </div>
                  <div>
                    <label className="label">مهلة الإنجاز بالساعات (اختياري)</label>
                    <input type="number" className="field text-center" min={0} placeholder="مثال: 48" value={editTask.durationHours ?? ''} onChange={e => setEditTask({ ...editTask, durationHours: e.target.value ? parseInt(e.target.value, 10) || null : null })} />
                  </div>
                </div>
                <div>
                  <label className="label">الصورة التوضيحية</label>
                  <div onClick={() => editFileRef.current?.click()} className="border border-dashed border-ink-300 rounded-xl p-3 text-center cursor-pointer hover:bg-cream-100/50">
                    <input ref={editFileRef} type="file" accept="image/*" className="hidden" onChange={e => handleImagePick(e, true)} />
                    {editTask.imageUrl ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editTask.imageUrl} alt="Preview" className="max-h-36 mx-auto rounded" />
                        <button type="button" className="btn btn-secondary text-xs" onClick={ev => { ev.stopPropagation(); setEditTask({ ...editTask, imageUrl: null }); }}>إزالة</button>
                      </div>
                    ) : <div className="py-2 text-ink-400 text-xs">اضغط لرفع صورة جديدة</div>}
                  </div>
                </div>
                <div>
                  <label className="label">رابط مرجعي</label>
                  <input type="url" className="field" value={editTask.resourceLink || ''} onChange={e => setEditTask({ ...editTask, resourceLink: e.target.value || null })} />
                </div>
                <div>
                  <label className="label">المشرف المسؤول</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setEditTask({ ...editTask, assignedAdmins: [] })} className={`choice text-xs py-0.5 px-2.5 ${editTask.assignedAdmins.length === 0 ? 'is-active' : ''}`}>الجميع</button>
                    {supervisors.map(s => (
                      <button key={s.id} type="button" onClick={() => toggleAdminChip(String(s.id), true)} className={`choice text-xs py-0.5 px-2.5 ${editTask.assignedAdmins.includes(String(s.id)) ? 'is-active' : ''}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
                <button type="button" onClick={() => setEditTask(null)} className="btn btn-ghost text-sm">إلغاء</button>
                <button type="submit" disabled={editBusy} className="btn btn-primary text-sm font-bold">{editBusy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SCOPE */}
      {scopeTask && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setScopeTask(null)}>
          <div className="modal-panel w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <div>
                <h3 className="text-lg font-bold text-ink-900">نطاق المهمة</h3>
                <div className="text-xs text-ink-400 mt-0.5">{scopeTask.title}</div>
              </div>
              <button className="text-2xl text-ink-400" onClick={() => setScopeTask(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setScopeTask({ ...scopeTask, visibility: 'all' })} className={`choice flex-1 py-2 text-center ${scopeTask.visibility === 'all' ? 'is-active' : ''}`}>متاحة للجميع</button>
                <button type="button" onClick={() => setScopeTask({ ...scopeTask, visibility: 'restricted' })} className={`choice flex-1 py-2 text-center ${scopeTask.visibility === 'restricted' ? 'is-active' : ''}`}>طلاب محددون</button>
              </div>
              {scopeTask.visibility === 'restricted' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" className="field py-1 px-3 text-xs flex-1" placeholder="ابحث..." value={scopeSearch} onChange={e => setScopeSearch(e.target.value)} />
                    <button type="button" className="btn btn-secondary py-1 px-2 text-xs" onClick={() => setScopeSelected([])}>إلغاء الكل</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-ink-200 rounded-lg p-2 space-y-1 scroll-soft">
                    {students
                      .filter(s => s.registrationStatus === 'approved' && (!scopeSearch.trim() || s.studentName.toLowerCase().includes(scopeSearch.trim().toLowerCase())))
                      .map(st => {
                        const checked = scopeSelected.includes(st.id);
                        return (
                          <label key={st.id} className="flex items-center gap-2.5 p-1.5 hover:bg-cream-100/50 rounded cursor-pointer text-xs">
                            <input type="checkbox" checked={checked} className="accent-brand" onChange={() => setScopeSelected(checked ? scopeSelected.filter(i => i !== st.id) : [...scopeSelected, st.id])} />
                            <span>{st.studentName} ({st.stage} - {st.grade})</span>
                          </label>
                        );
                      })}
                  </div>
                  <div className="text-xs text-ink-500">{scopeSelected.length} طالب محدد</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
              <button onClick={() => setScopeTask(null)} className="btn btn-ghost text-sm">إلغاء</button>
              <button onClick={handleScopeConfirm} disabled={scopeBusy || (scopeTask.visibility === 'restricted' && scopeSelected.length === 0)} className="btn btn-primary text-sm font-bold">
                {scopeBusy ? 'جارٍ الحفظ…' : 'تحديث النطاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STATISTICS */}
      {statsTask && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setStatsTask(null)}>
          <div className="modal-panel w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <div>
                <h3 className="text-lg font-bold text-ink-900">إحصائيات التسليمات</h3>
                <div className="text-xs text-ink-400 mt-0.5">{statsTask.title}</div>
              </div>
              <button className="text-2xl text-ink-400" onClick={() => setStatsTask(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'المستهدفين', val: statsCounts.total, bg: 'bg-ink-50', border: 'border-ink-150', text: 'text-ink-800' },
                  { label: 'سلّموا', val: statsCounts.submitted, bg: 'bg-brand/10', border: 'border-brand/20', text: 'text-brand-600' },
                  { label: 'لم يسلّموا', val: statsCounts.missing, bg: 'bg-nred-50', border: 'border-nred-100', text: 'text-nred-600' },
                  { label: 'بانتظار التقييم', val: statsCounts.pending, bg: 'bg-yellow-50', border: 'border-yellow-250', text: 'text-yellow-600' },
                ].map(({ label, val, bg, border, text }) => (
                  <div key={label} className={`p-2.5 rounded-lg border ${bg} ${border}`}>
                    <div className={`text-xl font-extrabold ${text}`}>{val}</div>
                    <div className={`text-[0.65rem] font-bold ${text} opacity-80`}>{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <input type="text" placeholder="ابحث…" className="field py-1 px-3 text-xs flex-1" value={statsSearch} onChange={e => setStatsSearch(e.target.value)} />
                <select className="field py-1 px-3 text-xs sm:w-44" value={statsFilter} onChange={e => setStatsFilter(e.target.value as 'all' | 'submitted' | 'missing')}>
                  <option value="all">الجميع</option>
                  <option value="submitted">سلّموا فقط</option>
                  <option value="missing">لم يسلّموا</option>
                </select>
              </div>
              <div className="max-h-64 overflow-y-auto border border-ink-200 rounded-lg scroll-soft">
                {statsStudentList.length === 0 ? (
                  <div className="text-center py-10 text-ink-400 text-xs">لا يوجد طلاب.</div>
                ) : (
                  <table className="tbl text-right text-xs">
                    <thead><tr><th>الطالب</th><th>الحالة</th><th>الدرجة</th><th>التاريخ</th></tr></thead>
                    <tbody>
                      {statsStudentList.map(item => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.studentName} ({item.stage})</td>
                          <td>
                            {item.submitted ? (
                              <span className={`pill ${statusBadgeClass(item.submission!.status)} py-0.5 px-2`}>{statusLabel(item.submission!.status)}</span>
                            ) : (
                              <span className="pill pill-red py-0.5 px-2">لم يسلّم</span>
                            )}
                          </td>
                          <td className="font-bold text-center">{item.submission?.status === 'approved' ? `${item.submission.grade} ن` : '—'}</td>
                          <td className="font-mono text-[0.7rem] text-ink-500">{item.submission ? item.submission.submittedAt.split('T')[0] : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-ink-200">
              <button onClick={() => setStatsTask(null)} className="btn btn-primary text-sm font-bold">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORY MANAGEMENT */}
      {showCatModal && isScientific && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setShowCatModal(false)}>
          <div className="modal-panel w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <h3 className="text-lg font-bold text-ink-900">إدارة التصنيفات</h3>
              <button className="text-2xl text-ink-400" onClick={() => setShowCatModal(false)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <input type="text" className="field py-1.5 px-3 text-sm flex-1" placeholder="أضف تصنيفاً جديداً..."
                  value={newCategory} onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
                <button type="button" disabled={savingCats} className="btn btn-primary text-sm py-1.5 px-4" onClick={addCategory}>إضافة</button>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto scroll-soft">
                {categories.map(cat => (
                  <div key={cat} className="flex items-center gap-2 bg-cream-50 border border-ink-150 rounded-lg px-3 py-2">
                    {editingCat?.original === cat ? (
                      <>
                        <input autoFocus type="text" className="field py-1 px-2 text-sm flex-1"
                          value={editingCat.value}
                          onChange={e => setEditingCat({ original: cat, value: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } if (e.key === 'Escape') setEditingCat(null); }} />
                        <button className="btn btn-primary py-1 px-2.5 text-xs" onClick={commitRename}>حفظ</button>
                        <button className="btn btn-secondary py-1 px-2 text-xs" onClick={() => setEditingCat(null)}>إلغاء</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-semibold text-ink-800">{cat}</span>
                        {cat === 'عام' ? (
                          <span className="text-[11px] text-ink-400">افتراضي</span>
                        ) : (
                          <>
                            <button className="text-brand-600 hover:underline text-xs font-bold" onClick={() => setEditingCat({ original: cat, value: cat })}>تعديل</button>
                            <button className="text-nred-600 hover:text-nred-800 text-lg leading-none px-1" onClick={() => removeCategory(cat)}>×</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end p-4 border-t border-ink-200">
              <button onClick={() => setShowCatModal(false)} className="btn btn-primary text-sm font-bold">تم</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`choice py-2 px-4 text-sm font-bold shrink-0 flex items-center gap-1.5 ${active ? 'is-active' : ''}`}>
      {children}
    </button>
  );
}

function SubmissionCard({
  sub, supervisors, onEvaluate, isLog = false,
  collapsible = false, expanded = false, onToggle,
  inlineEditSub, inlinePoints, setInlineEditSub, setInlinePoints, saveInlinePoints, inlineBusy,
}: {
  sub: Submission; supervisors: SupervisorUser[]; onEvaluate?: (s: Submission) => void; isLog?: boolean;
  collapsible?: boolean; expanded?: boolean; onToggle?: () => void;
  inlineEditSub?: string | null; inlinePoints?: string;
  setInlineEditSub?: (id: string | null) => void; setInlinePoints?: (v: string) => void;
  saveInlinePoints?: (s: Submission) => void; inlineBusy?: boolean;
}) {
  const isPending = sub.status === 'pending';
  const isApproved = sub.status === 'approved';
  const isRejected = sub.status === 'rejected';
  const showBody = !collapsible || expanded;
  const assignedLabel = sub.taskAssignedAdmins.length === 0 ? 'جميع المشرفين'
    : sub.taskAssignedAdmins.map(id => supervisors.find(s => String(s.id) === id)?.name).filter(Boolean).join('، ');

  return (
    <div className={`card p-5 relative overflow-hidden transition-all ${collapsible ? 'cursor-pointer hover:shadow-md' : 'hover:shadow-md'}`}
      style={{ borderRight: `4px solid ${isPending ? '#FFA726' : isApproved ? 'var(--accent)' : '#EF4444'}` }}
      onClick={collapsible ? onToggle : undefined}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-brand/10 text-brand-600 font-extrabold flex items-center justify-center text-lg shrink-0">
            {sub.studentName?.charAt(0) || 'ط'}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-ink-900 text-sm truncate">{sub.studentName}</h4>
            <span className="text-[0.7rem] text-ink-400 font-mono">{sub.submittedAt.split('T')[0]} {sub.submittedAt.split('T')[1]?.substring(0, 5)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`pill ${isPending ? 'pill-yellow' : isApproved ? 'pill-green' : 'pill-red'} text-xs font-bold`}>
            {statusLabel(sub.status)}
          </span>
          {collapsible && (
            <svg className={`w-4 h-4 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {/* compact task line — always visible */}
      <div className="mt-3 text-sm flex items-center gap-2 flex-wrap">
        <span className="text-xs text-ink-400 font-bold">المهمة:</span>
        <span className="font-semibold text-ink-850">{sub.taskTitle}</span>
        {!showBody && isApproved && sub.grade !== null && <span className="pill pill-green text-[11px]">{sub.grade} / {sub.taskMaxPoints}</span>}
      </div>

      {showBody && (
        <div className={collapsible ? 'mt-3 fade-in' : 'mt-3'} onClick={collapsible ? (e => e.stopPropagation()) : undefined}>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {sub.taskTrack && <span className="pill pill-gray text-[11px]">{sub.taskTrack}</span>}
            <span className="pill pill-yellow text-[11px]">الحد الأقصى: {sub.taskMaxPoints}</span>
          </div>

          {sub.fileUrl && (
            <div className="mb-4 bg-ink-50/20 p-2.5 rounded-lg border border-ink-150/50">
              <div className="text-xs text-ink-400 font-bold mb-1.5">محتوى التسليم:</div>
              <SubmissionContent fileUrl={sub.fileUrl} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
            <div><span className="font-bold">المشرف الموجه:</span> <span className="font-medium text-ink-700">{assignedLabel}</span></div>
            {!isPending && (
              <div>
                {isApproved && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {inlineEditSub === sub.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={0} max={sub.taskMaxPoints} className="field py-0.5 px-1.5 w-16 text-center font-bold"
                          value={inlinePoints} onChange={e => setInlinePoints?.(e.target.value.replace(/\D/g, ''))} />
                        <button onClick={() => saveInlinePoints?.(sub)} disabled={inlineBusy} className="btn btn-primary py-0.5 px-2 text-[0.7rem]">حفظ</button>
                        <button onClick={() => setInlineEditSub?.(null)} className="btn btn-secondary py-0.5 px-1.5 text-[0.7rem]">إلغاء</button>
                      </div>
                    ) : (
                      <>
                        <span className="pill pill-green font-extrabold text-[0.75rem]">الدرجة: {sub.grade} / {sub.taskMaxPoints}</span>
                        <button onClick={() => { setInlineEditSub?.(sub.id); setInlinePoints?.(String(sub.grade || 0)); }} className="text-brand-600 hover:underline font-bold text-[0.7rem]">تعديل</button>
                      </>
                    )}
                  </div>
                )}
                {isRejected && <span className="text-nred-600 font-bold bg-nred-50 py-0.5 px-2 rounded">تم رد المهمة</span>}
                {sub.feedback && <div className="mt-1 text-ink-400 italic">تعليق: &ldquo;{sub.feedback}&rdquo;</div>}
              </div>
            )}
          </div>

          {isPending && onEvaluate && (
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => onEvaluate(sub)} className="btn btn-danger py-1.5 px-4 text-xs">رد المهمة</button>
              <button onClick={() => onEvaluate(sub)} className="btn btn-primary py-1.5 px-4 text-xs font-bold">قبول وتقييم النقاط</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
