'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { pushToast } from '@/components/Toast';
import { useSupervisor } from '@/components/SupervisorShell';
import { compressImage } from '@/lib/imageUtils';

type Student = { id: number; membershipNo: number; studentName: string; stage: string; grade: string; registrationStatus: string; paymentStatus: string };
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


function statusLabel(status: string) {
  if (status === 'approved') return 'مقبولة ✓';
  if (status === 'rejected') return 'مردودة ✗';
  return 'بانتظار المراجعة';
}

function statusBadgeClass(status: string) {
  if (status === 'approved') return 'pill-green';
  if (status === 'rejected') return 'pill-red';
  return 'pill-yellow';
}

export default function TasksPage() {
  const { user } = useSupervisor();
  const [activeTab, setActiveTab] = useState<'submissions' | 'log' | 'add' | 'manage'>('submissions');
  const [loading, setLoading] = useState(true);

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
  const [addResourceLink, setAddResourceLink] = useState('');
  const [addImage, setAddImage] = useState<string | null>(null);
  const [addAdmins, setAddAdmins] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);

  // Edit task state references
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

  // Filtered submissions (pending review)
  const pendingSubmissions = useMemo(() => {
    return submissions.filter(s => s.status === 'pending');
  }, [submissions]);

  const filteredPendingSubmissions = useMemo(() => {
    return pendingSubmissions.filter(s => {
      const matchQ = !subSearch.trim() || s.studentName.toLowerCase().includes(subSearch.trim().toLowerCase());
      const matchTask = !subTaskFilter || s.taskId === subTaskFilter;
      const matchAdmin = !subAdminFilter || 
        (subAdminFilter === '__all__' ? s.taskAssignedAdmins.length === 0 : s.taskAssignedAdmins.includes(subAdminFilter));
      return matchQ && matchTask && matchAdmin;
    });
  }, [pendingSubmissions, subSearch, subTaskFilter, subAdminFilter]);

  // Filtered evaluation log (approved/rejected)
  const logSubmissions = useMemo(() => {
    return submissions.filter(s => s.status !== 'pending');
  }, [submissions]);

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

  // Filtered tasks for management
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      return !manageSearch.trim() || t.title.toLowerCase().includes(manageSearch.trim().toLowerCase()) || t.description.toLowerCase().includes(manageSearch.trim().toLowerCase());
    });
  }, [tasks, manageSearch]);

  // Unique tasks listing for filters
  const uniqueTasksPending = useMemo(() => {
    const ids = new Set(pendingSubmissions.map(s => s.taskId));
    return tasks.filter(t => ids.has(t.id));
  }, [tasks, pendingSubmissions]);

  const uniqueTasksLog = useMemo(() => {
    const ids = new Set(logSubmissions.map(s => s.taskId));
    return tasks.filter(t => ids.has(t.id));
  }, [tasks, logSubmissions]);



  // Add Task submit handler
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!addTitle.trim() || !addDesc.trim() || !addDeadline) {
      return pushToast('error', 'يرجى إدخال جميع الحقول الإلزامية');
    }

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
          assignedAdmins: addAdmins,
          imageUrl: addImage,
          resourceLink: addResourceLink.trim() || null,
          visibility: 'all',
          visibleToIds: [],
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المهمة');

      pushToast('success', 'تم نشر المهمة بنجاح ✓');
      // Reset form
      setAddTitle('');
      setAddDesc('');
      setAddPoints('10');
      setAddDeadline('');
      setAddMethod('رفع ملف');
      setAddResourceLink('');
      setAddImage(null);
      setAddAdmins([]);
      
      // Reload and go to management tab
      await loadData();
      setActiveTab('manage');
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ في الشبكة');
    } finally {
      setAddBusy(false);
    }
  }

  // Evaluate submission handler (approve/reject)
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
      setEvalSub(null);
      setEvalPoints('');
      setEvalComment('');
      loadData();
    } catch (err: any) {
      pushToast('error', err.message || 'حدث خطأ أثناء التقييم');
    } finally {
      setEvalBusy(false);
    }
  }

  // Toggle Task Active/Inactive
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

  // Delete Task
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

  // Update Task handler
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
          submissionMethod: editTask.submissionMethod,
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

  // Visibility Scope confirm handler
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

  // Student list filter for stats modal
  const statsStudentList = useMemo(() => {
    if (!statsTask) return [];
    
    // Filter active student list (approved students only, or all)
    const activeStudents = students.filter(s => s.registrationStatus === 'approved' && s.paymentStatus === 'paid');

    // If restricted, only show students in visibleToIds scope
    const scopedStudents = statsTask.visibility === 'restricted'
      ? activeStudents.filter(s => statsTask.visibleToIds.includes(s.id))
      : activeStudents;

    const taskSubmissionsMap = new Map(
      submissions.filter(s => s.taskId === statsTask.id).map(s => [s.registrationId, s])
    );

    const list = scopedStudents.map(student => {
      const sub = taskSubmissionsMap.get(student.id);
      return {
        ...student,
        submitted: !!sub,
        submission: sub || null
      };
    });

    // Apply search filter
    const query = statsSearch.trim().toLowerCase();
    let filtered = list;
    if (query) {
      filtered = list.filter(item => item.studentName.toLowerCase().includes(query));
    }

    // Apply submission status filter
    if (statsFilter === 'submitted') {
      filtered = filtered.filter(item => item.submitted);
    } else if (statsFilter === 'missing') {
      filtered = filtered.filter(item => !item.submitted);
    }

    return filtered;
  }, [statsTask, students, submissions, statsSearch, statsFilter]);

  const statsCounts = useMemo(() => {
    if (!statsTask) return { total: 0, submitted: 0, missing: 0, pending: 0 };
    
    const activeStudents = students.filter(s => s.registrationStatus === 'approved' && s.paymentStatus === 'paid');
    const scopedStudents = statsTask.visibility === 'restricted'
      ? activeStudents.filter(s => statsTask.visibleToIds.includes(s.id))
      : activeStudents;

    const taskSubmissions = submissions.filter(s => s.taskId === statsTask.id);
    const submittedIds = new Set(taskSubmissions.map(s => s.registrationId));
    
    const total = scopedStudents.length;
    const submitted = scopedStudents.filter(s => submittedIds.has(s.id)).length;
    const pending = taskSubmissions.filter(s => s.status === 'pending').length;
    const missing = total - submitted;

    return { total, submitted, missing, pending };
  }, [statsTask, students, submissions]);

  // Image helpers
  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressImage(file, 200);
      if (isEdit && editTask) {
        setEditTask({ ...editTask, imageUrl: base64 });
      } else {
        setAddImage(base64);
      }
      pushToast('info', 'تم تحميل وتجهيز الصورة بنجاح ✓');
    } catch {
      pushToast('error', 'تعذر معالجة الصورة');
    }
  }

  // Toggle assigned admin chip
  const toggleAdminChip = (id: string, isEdit = false) => {
    if (isEdit && editTask) {
      const current = editTask.assignedAdmins;
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      setEditTask({ ...editTask, assignedAdmins: next });
    } else {
      const next = addAdmins.includes(id) ? addAdmins.filter(x => x !== id) : [...addAdmins, id];
      setAddAdmins(next);
    }
  };

  const getSupervisorName = (id: string) => {
    const s = supervisors.find(x => String(x.id) === id);
    return s ? s.name : 'مشرف غير معروف';
  };

  // Inline points editor for log
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

  return (
    <div dir="rtl" className="w-full">
      {/* Title Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 mb-1">إدارة المهام والتحديات</h1>
          <p className="text-sm text-ink-500">قم بنشر المهام للطلاب، تقييم درجاتهم، ومراجعة تسليماتهم.</p>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex gap-2 mb-6 border-b border-ink-200 pb-2 overflow-x-auto scroll-soft">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`choice py-2 px-4 text-sm font-bold shrink-0 ${activeTab === 'submissions' ? 'is-active' : ''}`}
        >
          📥 المهام المسلمة
          {pendingSubmissions.length > 0 && (
            <span className="mr-1.5 px-2 py-0.5 rounded-full bg-nred-600 text-white text-xs font-mono">
              {pendingSubmissions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`choice py-2 px-4 text-sm font-bold shrink-0 ${activeTab === 'log' ? 'is-active' : ''}`}
        >
          📜 سجل التقييمات
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`choice py-2 px-4 text-sm font-bold shrink-0 ${activeTab === 'add' ? 'is-active' : ''}`}
        >
          ✍️ إضافة مهمة
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`choice py-2 px-4 text-sm font-bold shrink-0 ${activeTab === 'manage' ? 'is-active' : ''}`}
        >
          ⚙️ إدارة المهام
        </button>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-ink-400 text-sm">جارٍ تحميل البيانات…</div>
      ) : (
        <>
          {/* TAB 1: SUBMISSIONS REVIEW */}
          {activeTab === 'submissions' && (
            <div className="space-y-4 fade-in">
              {/* Filters */}
              {pendingSubmissions.length > 0 && (
                <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label">البحث عن طالب</label>
                    <input
                      type="text"
                      className="field py-1.5 px-3 text-sm"
                      placeholder="ابحث باسم الطالب..."
                      value={subSearch}
                      onChange={e => setSubSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">تصفية حسب المهمة</label>
                    <select
                      className="field py-1.5 px-3 text-sm"
                      value={subTaskFilter}
                      onChange={e => setSubTaskFilter(e.target.value)}
                    >
                      <option value="">كل المهام</option>
                      {uniqueTasksPending.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">المشرف المسؤول</label>
                    <select
                      className="field py-1.5 px-3 text-sm"
                      value={subAdminFilter}
                      onChange={e => setSubAdminFilter(e.target.value)}
                    >
                      <option value="">كل المشرفين</option>
                      <option value="__all__">جميع المشرفين (غير محدد)</option>
                      {supervisors.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* List */}
              {filteredPendingSubmissions.length === 0 ? (
                <div className="card text-center p-12 space-y-3">
                  <div className="text-3xl">🎉</div>
                  <h3 className="font-bold text-lg text-ink-900">لا توجد تسليمات معلقة</h3>
                  <p className="text-sm text-ink-500">
                    {pendingSubmissions.length > 0 ? 'لا توجد نتائج تطابق خيارات التصفية الحالية.' : 'لقد تم تقييم جميع تسليمات الطلاب بنجاح.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPendingSubmissions.map(sub => (
                    <SubmissionCard
                      key={sub.id}
                      sub={sub}
                      onEvaluate={setEvalSub}
                      supervisors={supervisors}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EVALUATION LOG */}
          {activeTab === 'log' && (
            <div className="space-y-4 fade-in">
              {/* Filters */}
              {logSubmissions.length > 0 && (
                <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="label">اسم الطالب</label>
                    <input
                      type="text"
                      className="field py-1.5 px-3 text-sm"
                      placeholder="ابحث عن طالب..."
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">المهمة</label>
                    <select
                      className="field py-1.5 px-3 text-sm"
                      value={logTaskFilter}
                      onChange={e => setLogTaskFilter(e.target.value)}
                    >
                      <option value="">كل المهام</option>
                      {uniqueTasksLog.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">حالة التقييم</label>
                    <select
                      className="field py-1.5 px-3 text-sm"
                      value={logStatusFilter}
                      onChange={e => setLogStatusFilter(e.target.value)}
                    >
                      <option value="">كل الحالات</option>
                      <option value="approved">مقبولة</option>
                      <option value="rejected">مردودة</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">المشرف المسؤول</label>
                    <select
                      className="field py-1.5 px-3 text-sm"
                      value={logAdminFilter}
                      onChange={e => setLogAdminFilter(e.target.value)}
                    >
                      <option value="">كل المشرفين</option>
                      <option value="__all__">جميع المشرفين (غير محدد)</option>
                      {supervisors.map(s => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Log List */}
              {filteredLogSubmissions.length === 0 ? (
                <div className="card text-center p-12 text-ink-400">لا توجد تقييمات مسجلة بعد.</div>
              ) : (
                <div className="space-y-4">
                  {filteredLogSubmissions.map(sub => (
                    <SubmissionCard
                      key={sub.id}
                      sub={sub}
                      supervisors={supervisors}
                      isLog
                      inlineEditSub={inlineEditSub}
                      inlinePoints={inlinePoints}
                      setInlineEditSub={setInlineEditSub}
                      setInlinePoints={setInlinePoints}
                      saveInlinePoints={saveInlinePoints}
                      inlineBusy={inlineBusy}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADD TASK */}
          {activeTab === 'add' && (
            <div className="max-w-2xl mx-auto fade-in">
              <form onSubmit={handleAddTask} className="card p-6 space-y-4">
                <h2 className="text-lg font-bold text-ink-900 border-b border-ink-150 pb-2 mb-4">إنشاء ونشر مهمة جديدة</h2>
                
                <div>
                  <label className="label">عنوان المهمة <span className="req">*</span></label>
                  <input
                    type="text"
                    className="field"
                    required
                    placeholder="مثال: حفظ سورة الملك..."
                    value={addTitle}
                    onChange={e => setAddTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">وصف وتفاصيل المهمة <span className="req">*</span></label>
                  <textarea
                    className="field"
                    required
                    rows={4}
                    placeholder="اكتب تفاصيل وشروط المهمة بالتفصيل للطلاب..."
                    value={addDesc}
                    onChange={e => setAddDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">نقاط الإنجاز <span className="req">*</span></label>
                    <input
                      type="number"
                      className="field text-center"
                      required
                      min={1}
                      value={addPoints}
                      onChange={e => setAddPoints(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="label">طريقة التسليم <span className="req">*</span></label>
                    <select
                      className="field"
                      value={addMethod}
                      onChange={e => setAddMethod(e.target.value)}
                    >
                      <option value="رفع ملف">رفع ملف (صورة / مستند / فيديو)</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">تاريخ الاستحقاق <span className="req">*</span></label>
                    <input
                      type="date"
                      className="field"
                      required
                      value={addDeadline}
                      onChange={e => setAddDeadline(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">صورة توضيحية للمهمة (اختياري)</label>
                  <div 
                    onClick={() => addFileRef.current?.click()}
                    className="border-2 border-dashed border-ink-300 rounded-xl p-4 text-center cursor-pointer hover:bg-cream-100/50 transition-all"
                  >
                    <input
                      ref={addFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleImagePick(e, false)}
                    />
                    {addImage ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={addImage} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                        <button type="button" className="btn btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); setAddImage(null); }}>إزالة الصورة</button>
                      </div>
                    ) : (
                      <div className="py-2 text-ink-400 text-sm">🖼️ اضغط لاختيار صورة للمهمة</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">رابط مرجعي خارجي (اختياري)</label>
                  <input
                    type="url"
                    className="field"
                    placeholder="https://example.com/resource"
                    value={addResourceLink}
                    onChange={e => setAddResourceLink(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">المشرف المسؤول عن التقييم</label>
                  <p className="text-xs text-ink-400 mb-2">اختر مشرفاً واحداً أو أكثر. عدم تحديد أي مشرف يعني أن الجميع يستطيع التقييم.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAddAdmins([])}
                      className={`choice text-xs font-semibold py-1 px-3 ${addAdmins.length === 0 ? 'is-active' : ''}`}
                    >
                      جميع المشرفين
                    </button>
                    {supervisors.map(s => {
                      const active = addAdmins.includes(String(s.id));
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleAdminChip(String(s.id), false)}
                          className={`choice text-xs font-semibold py-1 px-3 ${active ? 'is-active' : ''}`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addBusy}
                  className="btn btn-primary w-full py-2.5 font-bold"
                >
                  {addBusy ? 'جارٍ نشر المهمة…' : 'نشر المهمة والتحدي للطلاب 🚀'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: MANAGE TASKS */}
          {activeTab === 'manage' && (
            <div className="space-y-4 fade-in">
              <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="🔍 ابحث في المهام المنشورة..."
                  className="field py-1.5 px-3 text-sm sm:w-80"
                  value={manageSearch}
                  onChange={e => setManageSearch(e.target.value)}
                />
                <div className="text-xs text-ink-400">إجمالي المهام المنشورة: {tasks.length} مهمة</div>
              </div>

              <div className="card p-0 overflow-hidden">
                {filteredTasks.length === 0 ? (
                  <p className="text-center py-12 text-ink-400 text-sm">لا توجد مهام منشورة تطابق البحث.</p>
                ) : (
                  <div className="overflow-x-auto scroll-soft">
                    <table className="tbl text-right">
                      <thead>
                        <tr>
                          <th>المهمة</th>
                          <th>النقاط</th>
                          <th>تاريخ الاستحقاق</th>
                          <th>الحالة</th>
                          <th>النطاق</th>
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
                            <td className="font-bold text-brand-600">{task.maxPoints} نقطة</td>
                            <td className="text-sm font-mono">{task.dueDate.split('T')[0]}</td>
                            <td>
                              <span className={`pill ${task.isActive ? 'pill-green' : 'pill-red'}`}>
                                {task.isActive ? 'نشطة' : 'معطلة'}
                              </span>
                            </td>
                            <td>
                              {task.visibility === 'restricted' ? (
                                <span className="pill pill-gray" title="طلاب محددون فقط">
                                  👥 {task.visibleToIds.length} طالب
                                </span>
                              ) : (
                                <span className="pill pill-green">🌐 الجميع</span>
                              )}
                            </td>
                            <td>
                              <div className="flex gap-1 justify-center">
                                <button
                                  className="btn btn-secondary py-1 px-2.5 text-xs font-semibold"
                                  onClick={() => setEditTask(task)}
                                >
                                  تعديل
                                </button>
                                <button
                                  className={`btn py-1 px-2.5 text-xs font-semibold ${task.isActive ? 'btn-danger' : 'btn-primary'}`}
                                  onClick={() => toggleTaskActive(task)}
                                >
                                  {task.isActive ? 'تعطيل' : 'تفعيل'}
                                </button>
                                <button
                                  className="btn btn-secondary py-1 px-2.5 text-xs font-semibold"
                                  onClick={() => {
                                    setScopeTask(task);
                                    setScopeSelected(task.visibleToIds || []);
                                    setScopeSearch('');
                                  }}
                                >
                                  النطاق
                                </button>
                                <button
                                  className="btn btn-secondary py-1 px-2.5 text-xs font-semibold"
                                  onClick={() => {
                                    setStatsTask(task);
                                    setStatsSearch('');
                                    setStatsFilter('all');
                                  }}
                                >
                                  إحصائيات
                                </button>
                                <button
                                  className="text-nred-600 hover:text-nred-800 text-lg px-2"
                                  onClick={() => handleTaskDelete(task.id, task.title)}
                                  title="حذف نهائي"
                                >
                                  ×
                                </button>
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
        </>
      )}

      {/* MODAL 1: SUBMISSION EVALUATION (APPROVE/REJECT) */}
      {evalSub && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEvalSub(null)}>
          <div className="modal-panel w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <h3 className="text-lg font-bold text-ink-900">مراجعة وتقييم المهمة</h3>
              <button className="text-2xl text-ink-400 hover:text-ink-900" onClick={() => setEvalSub(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-cream-50 p-3 rounded-lg border border-ink-150">
                <div className="text-xs text-ink-400">الطالب والمهمة:</div>
                <div className="font-bold text-ink-900 text-sm">{evalSub.studentName}</div>
                <div className="text-sm font-semibold text-brand-600 mt-1">{evalSub.taskTitle}</div>
              </div>

              {/* Submitted contents */}
              {evalSub.fileUrl && (
                <div>
                  <div className="label">مرفق إثبات الإنجاز:</div>
                  {evalSub.fileUrl.startsWith('data:image') || evalSub.fileUrl.startsWith('http') && evalSub.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={evalSub.fileUrl} alt="إثبات التسليم" className="max-h-60 rounded-lg border border-ink-200 mx-auto" />
                  ) : evalSub.fileUrl === 'admin://manual-mark' ? (
                    <div className="bg-ink-50 p-3 rounded text-sm text-ink-600">رصد يدوي مباشر من المشرف (بدون ملف مرفق)</div>
                  ) : (
                    <a href={evalSub.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-block text-xs font-semibold py-1.5 px-3">
                      📄 فتح الملف المرفق في نافذة جديدة
                    </a>
                  )}
                </div>
              )}

              {/* Points slider/input */}
              <div>
                <label className="label">النقاط الممنوحة (الحد الأقصى: {evalSub.taskMaxPoints})</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={evalSub.taskMaxPoints}
                    className="field w-24 text-center font-bold text-lg"
                    value={evalPoints === '' ? evalSub.taskMaxPoints : evalPoints}
                    onChange={e => setEvalPoints(e.target.value.replace(/\D/g, ''))}
                  />
                  <div className="flex-1 flex gap-1">
                    <button type="button" onClick={() => setEvalPoints(String(evalSub.taskMaxPoints))} className="btn btn-secondary text-xs flex-1">كامل</button>
                    <button type="button" onClick={() => setEvalPoints(String(Math.round(evalSub.taskMaxPoints * 0.75)))} className="btn btn-secondary text-xs flex-1">75%</button>
                    <button type="button" onClick={() => setEvalPoints(String(Math.round(evalSub.taskMaxPoints * 0.5)))} className="btn btn-secondary text-xs flex-1">50%</button>
                    <button type="button" onClick={() => setEvalPoints('0')} className="btn btn-secondary text-xs flex-1">صفر</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">تعليق أو توجيه للطالب (اختياري)</label>
                <textarea
                  className="field"
                  rows={2}
                  placeholder="مثال: ممتاز، استمر في هذا التميز!"
                  value={evalComment}
                  onChange={e => setEvalComment(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
              <button
                onClick={() => handleEvaluate('rejected')}
                disabled={evalBusy}
                className="btn btn-danger text-sm"
              >
                رد المهمة للطلب (رفض)
              </button>
              <button
                onClick={() => handleEvaluate('approved')}
                disabled={evalBusy}
                className="btn btn-primary text-sm font-bold"
              >
                {evalBusy ? 'جارٍ الحفظ…' : 'اعتماد وقبول التسليم ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT TASK */}
      {editTask && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setEditTask(null)}>
          <div className="modal-panel w-full max-w-xl" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleUpdateTask}>
              <div className="flex items-center justify-between p-5 border-b border-ink-200">
                <h3 className="text-lg font-bold text-ink-900">تعديل بيانات المهمة</h3>
                <button type="button" className="text-2xl text-ink-400 hover:text-ink-900" onClick={() => setEditTask(null)}>×</button>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto scroll-soft">
                <div>
                  <label className="label">عنوان المهمة</label>
                  <input
                    type="text"
                    className="field"
                    required
                    value={editTask.title}
                    onChange={e => setEditTask({ ...editTask, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">الوصف</label>
                  <textarea
                    className="field"
                    required
                    rows={4}
                    value={editTask.description}
                    onChange={e => setEditTask({ ...editTask, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">النقاط</label>
                    <input
                      type="number"
                      className="field text-center font-bold"
                      required
                      min={1}
                      value={editTask.maxPoints}
                      onChange={e => setEditTask({ ...editTask, maxPoints: parseInt(e.target.value.replace(/\D/g, ''), 10) || 1 })}
                    />
                  </div>
                  <div>
                    <label className="label">طريقة التسليم</label>
                    <select
                      className="field"
                      value={editTask.submissionMethod || 'رفع ملف'}
                      onChange={e => setEditTask({ ...editTask, submissionMethod: e.target.value })}
                    >
                      <option value="رفع ملف">رفع ملف (صورة / مستند / فيديو)</option>
                      <option value="إقرار بالإنجاز">إقرار بالإنجاز فقط</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">تاريخ الاستحقاق</label>
                    <input
                      type="date"
                      className="field font-mono"
                      required
                      value={editTask.dueDate.split('T')[0]}
                      onChange={e => setEditTask({ ...editTask, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">تغيير الصورة التوضيحية (اختياري)</label>
                  <div 
                    onClick={() => editFileRef.current?.click()}
                    className="border border-dashed border-ink-300 rounded-xl p-3 text-center cursor-pointer hover:bg-cream-100/50"
                  >
                    <input
                      ref={editFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleImagePick(e, true)}
                    />
                    {editTask.imageUrl ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={editTask.imageUrl} alt="Preview" className="max-h-36 mx-auto rounded" />
                        <button type="button" className="btn btn-secondary text-xs" onClick={(e) => { e.stopPropagation(); setEditTask({ ...editTask, imageUrl: null }); }}>إزالة الصورة</button>
                      </div>
                    ) : (
                      <div className="py-2 text-ink-400 text-xs">🖼️ اضغط لرفع صورة جديدة للمهة</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label">رابط مرجعي</label>
                  <input
                    type="url"
                    className="field"
                    value={editTask.resourceLink || ''}
                    onChange={e => setEditTask({ ...editTask, resourceLink: e.target.value || null })}
                  />
                </div>

                <div>
                  <label className="label">المشرف المسؤول عن التقييم</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditTask({ ...editTask, assignedAdmins: [] })}
                      className={`choice text-xs py-0.5 px-2.5 ${editTask.assignedAdmins.length === 0 ? 'is-active' : ''}`}
                    >
                      جميع المشرفين
                    </button>
                    {supervisors.map(s => {
                      const active = editTask.assignedAdmins.includes(String(s.id));
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleAdminChip(String(s.id), true)}
                          className={`choice text-xs py-0.5 px-2.5 ${active ? 'is-active' : ''}`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
                <button type="button" onClick={() => setEditTask(null)} className="btn btn-ghost text-sm">إلغاء</button>
                <button type="submit" disabled={editBusy} className="btn btn-primary text-sm font-bold">
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
          <div className="modal-panel w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <div>
                <h3 className="text-lg font-bold text-ink-900">تعديل نطاق المهمة</h3>
                <div className="text-xs text-ink-400 mt-0.5">{scopeTask.title}</div>
              </div>
              <button className="text-2xl text-ink-400 hover:text-ink-900" onClick={() => setScopeTask(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScopeTask({ ...scopeTask, visibility: 'all' })}
                  className={`choice flex-1 text-center py-2 ${scopeTask.visibility === 'all' ? 'is-active' : ''}`}
                >
                  🌐 متاحة للجميع
                </button>
                <button
                  type="button"
                  onClick={() => setScopeTask({ ...scopeTask, visibility: 'restricted' })}
                  className={`choice flex-1 text-center py-2 ${scopeTask.visibility === 'restricted' ? 'is-active' : ''}`}
                >
                  👥 طلاب محددون فقط
                </button>
              </div>

              {scopeTask.visibility === 'restricted' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      className="field py-1 px-3 text-xs flex-1"
                      placeholder="ابحث باسم الطالب..."
                      value={scopeSearch}
                      onChange={e => setScopeSearch(e.target.value)}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="btn btn-secondary py-1 px-2 text-[0.7rem] font-semibold"
                        onClick={() => {
                          const query = scopeSearch.trim().toLowerCase();
                          const toSelect = students
                            .filter(s => s.registrationStatus === 'approved' && s.paymentStatus === 'paid')
                            .filter(s => !query || s.studentName.toLowerCase().includes(query))
                            .map(s => s.id);
                          setScopeSelected(Array.from(new Set([...scopeSelected, ...toSelect])));
                        }}
                      >
                        تحديد نتائج البحث
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary py-1 px-2 text-[0.7rem] font-semibold"
                        onClick={() => setScopeSelected([])}
                      >
                        إلغاء تحديد الكل
                      </button>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-ink-200 rounded-lg p-2 space-y-1.5 scroll-soft bg-ink-50/20">
                    {students
                      .filter(s => s.registrationStatus === 'approved' && s.paymentStatus === 'paid')
                      .filter(s => !scopeSearch.trim() || s.studentName.toLowerCase().includes(scopeSearch.trim().toLowerCase()))
                      .map(student => {
                        const checked = scopeSelected.includes(student.id);
                        return (
                          <label key={student.id} className="flex items-center gap-2.5 p-1.5 hover:bg-cream-100/50 rounded cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              className="accent-brand"
                              onChange={() => {
                                if (checked) {
                                  setScopeSelected(scopeSelected.filter(id => id !== student.id));
                                } else {
                                  setScopeSelected([...scopeSelected, student.id]);
                                }
                              }}
                            />
                            <span className="font-medium text-ink-800">{student.studentName} ({student.stage} - {student.grade})</span>
                          </label>
                        );
                      })}
                  </div>
                  <div className="text-xs text-ink-500 font-semibold">عدد الطلاب المحددين: {scopeSelected.length} طالب</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-ink-200">
              <button onClick={() => setScopeTask(null)} className="btn btn-ghost text-sm">إلغاء</button>
              <button
                onClick={handleScopeConfirm}
                disabled={scopeBusy || (scopeTask.visibility === 'restricted' && scopeSelected.length === 0)}
                className="btn btn-primary text-sm font-bold"
              >
                {scopeBusy ? 'جارٍ الحفظ…' : 'تحديث النطاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: STATISTICS & SUBMISSIONS */}
      {statsTask && (
        <div className="modal-backdrop flex items-center justify-center p-4 z-50" onClick={() => setStatsTask(null)}>
          <div className="modal-panel w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-ink-200">
              <div>
                <h3 className="text-lg font-bold text-ink-900">إحصائيات تسليمات الطلاب</h3>
                <div className="text-xs text-ink-400 mt-0.5">{statsTask.title}</div>
              </div>
              <button className="text-2xl text-ink-400 hover:text-ink-900" onClick={() => setStatsTask(null)}>×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Stats Strip */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-ink-50 p-2.5 rounded-lg border border-ink-150">
                  <div className="text-xl font-extrabold text-ink-800">{statsCounts.total}</div>
                  <div className="text-[0.65rem] text-ink-500 font-bold">المستهدفين</div>
                </div>
                <div className="bg-brand/10 p-2.5 rounded-lg border border-brand/20">
                  <div className="text-xl font-extrabold text-brand-600">{statsCounts.submitted}</div>
                  <div className="text-[0.65rem] text-brand-500 font-bold">تم التسليم</div>
                </div>
                <div className="bg-nred-50 p-2.5 rounded-lg border border-nred-100">
                  <div className="text-xl font-extrabold text-nred-600">{statsCounts.missing}</div>
                  <div className="text-[0.65rem] text-nred-500 font-bold">لم يسلموا</div>
                </div>
                <div className="bg-yellow-50 p-2.5 rounded-lg border border-yellow-250">
                  <div className="text-xl font-extrabold text-yellow-600">{statsCounts.pending}</div>
                  <div className="text-[0.65rem] text-yellow-500 font-bold">بانتظار التقييم</div>
                </div>
              </div>

              {/* List and search filters */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="🔍 ابحث عن طالب..."
                  className="field py-1 px-3 text-xs flex-1"
                  value={statsSearch}
                  onChange={e => setStatsSearch(e.target.value)}
                />
                <select
                  className="field py-1 px-3 text-xs sm:w-44"
                  value={statsFilter}
                  onChange={e => setStatsFilter(e.target.value as any)}
                >
                  <option value="all">جميع الطلاب المشمولين</option>
                  <option value="submitted">الذين سلّموا فقط</option>
                  <option value="missing">الذين لم يسلّموا</option>
                </select>
              </div>

              <div className="max-h-64 overflow-y-auto border border-ink-200 rounded-lg p-0 bg-ink-50/10 scroll-soft">
                {statsStudentList.length === 0 ? (
                  <div className="text-center py-10 text-ink-400 text-xs">لا يوجد طلاب يطابقون الفلاتر المحددة.</div>
                ) : (
                  <table className="tbl text-right text-xs">
                    <thead>
                      <tr>
                        <th>الطالب</th>
                        <th>الحالة</th>
                        <th>الدرجة</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsStudentList.map(item => (
                        <tr key={item.id}>
                          <td className="font-semibold">{item.studentName} ({item.stage} - {item.grade})</td>
                          <td>
                            {item.submitted ? (
                              <span className={`pill ${statusBadgeClass(item.submission!.status)} py-0.5 px-2`}>
                                {statusLabel(item.submission!.status)}
                              </span>
                            ) : (
                              <span className="pill pill-red py-0.5 px-2">لم يسلّم بعد</span>
                            )}
                          </td>
                          <td className="font-bold text-center">
                            {item.submission?.status === 'approved' ? `${item.submission.grade} ن` : '—'}
                          </td>
                          <td className="font-mono text-[0.7rem] text-ink-500">
                            {item.submission ? item.submission.submittedAt.split('T')[0] : '—'}
                          </td>
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
    </div>
  );
}

/* SUBMISSION CARD COMPONENT */
function SubmissionCard({
  sub,
  onEvaluate,
  supervisors,
  isLog = false,
  inlineEditSub,
  inlinePoints,
  setInlineEditSub,
  setInlinePoints,
  saveInlinePoints,
  inlineBusy
}: {
  sub: Submission;
  onEvaluate?: (sub: Submission) => void;
  supervisors: SupervisorUser[];
  isLog?: boolean;
  inlineEditSub?: string | null;
  inlinePoints?: string;
  setInlineEditSub?: (id: string | null) => void;
  setInlinePoints?: (val: string) => void;
  saveInlinePoints?: (sub: Submission) => void;
  inlineBusy?: boolean;
}) {
  const isPending = sub.status === 'pending';
  const isApproved = sub.status === 'approved';
  const isRejected = sub.status === 'rejected';

  const assignedLabel = sub.taskAssignedAdmins.length === 0
    ? 'جميع المشرفين'
    : sub.taskAssignedAdmins
        .map(id => supervisors.find(s => String(s.id) === id)?.name)
        .filter(Boolean)
        .join('، ');

  const getReviewerName = (emailOrId: string | null) => {
    if (!emailOrId) return '—';
    const s = supervisors.find(x => String(x.id) === emailOrId || x.email === emailOrId);
    return s ? s.name : emailOrId;
  };

  return (
    <div
      className="card p-5 relative overflow-hidden transition-all duration-200 hover:shadow-md"
      style={{
        borderRight: isPending
          ? '4px solid #FFA726'
          : isApproved
          ? '4px solid var(--accent)'
          : '4px solid #EF4444'
      }}
    >
      {/* Row 1: Student detail + Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/10 text-brand-600 font-extrabold flex items-center justify-center text-lg">
            {sub.studentName?.charAt(0) || 'ط'}
          </div>
          <div>
            <h4 className="font-bold text-ink-900 text-sm leading-none">{sub.studentName}</h4>
            <span className="text-[0.7rem] text-ink-400 font-mono inline-block mt-1">
              تسليم: {sub.submittedAt.split('T')[0]} {sub.submittedAt.split('T')[1]?.substring(0, 5)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className={`pill ${isPending ? 'pill-yellow' : isApproved ? 'pill-green' : 'pill-red'} text-xs font-bold`}>
            {statusLabel(sub.status)}
          </span>
        </div>
      </div>

      {/* Row 2: Task detail */}
      <div className="mb-3">
        <div className="text-xs text-ink-400 font-bold mb-1">المهمة المطلوبة:</div>
        <div className="font-semibold text-ink-850 text-sm">{sub.taskTitle}</div>
      </div>

      {/* Row 3: Image / Files / Manual details */}
      {sub.fileUrl && (
        <div className="mb-4 bg-ink-50/20 p-2.5 rounded-lg border border-ink-150/50">
          <div className="text-xs text-ink-400 font-bold mb-1.5">محتوى التسليم المرفق:</div>
          {sub.fileUrl.startsWith('data:image') || sub.fileUrl.startsWith('http') && sub.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sub.fileUrl}
              alt="إثبات الإنجاز"
              className="max-h-48 rounded border border-ink-200 cursor-zoom-in"
              onClick={() => window.open(sub.fileUrl, '_blank')}
            />
          ) : sub.fileUrl === 'admin://manual-mark' ? (
            <div className="text-xs text-ink-600">✍️ إقرار يدوي مباشر من المشرف</div>
          ) : (
            <a
              href={sub.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5"
            >
              📄 عرض المستند المرفق (PDF/ملف)
            </a>
          )}
        </div>
      )}

      {/* Row 4: Reviewer + Grading Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
        <div>
          <span className="font-bold">المشرف الموجه للمهمة:</span>{' '}
          <span className="font-medium text-ink-700">{assignedLabel}</span>
        </div>

        {/* Evaluation state display */}
        {!isPending && (
          <div>
            {isApproved && (
              <div className="flex items-center gap-2.5 flex-wrap">
                {inlineEditSub === sub.id ? (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={sub.taskMaxPoints}
                      className="field py-0.5 px-1.5 w-16 text-center font-bold"
                      value={inlinePoints}
                      onChange={e => setInlinePoints?.(e.target.value.replace(/\D/g, ''))}
                    />
                    <button
                      onClick={() => saveInlinePoints?.(sub)}
                      disabled={inlineBusy}
                      className="btn btn-primary py-0.5 px-2 text-[0.7rem] font-bold"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => setInlineEditSub?.(null)}
                      className="btn btn-secondary py-0.5 px-1.5 text-[0.7rem]"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="pill pill-green font-extrabold text-[0.75rem]">
                      الدرجة الممنوحة: {sub.grade} / {sub.taskMaxPoints} نقاط
                    </span>
                    <button
                      onClick={() => {
                        setInlineEditSub?.(sub.id);
                        setInlinePoints?.(String(sub.grade || 0));
                      }}
                      className="text-brand-600 hover:underline font-bold text-[0.7rem]"
                    >
                      ✏️ تعديل الدرجة
                    </button>
                  </>
                )}
              </div>
            )}
            {isRejected && (
              <span className="text-nred-600 font-bold bg-nred-50 py-0.5 px-2 rounded">
                تم رد المهمة للطلاب
              </span>
            )}
            {sub.feedback && (
              <div className="mt-1 text-ink-400 font-medium italic">
                تعليق المشرف ({getReviewerName(sub.selectedAdminId)}): &ldquo;{sub.feedback}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pending Actions */}
      {isPending && onEvaluate && (
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={() => onEvaluate(sub)}
            className="btn btn-primary py-1.5 px-4 text-xs font-bold"
          >
            تقييم واعتماد التسليم
          </button>
        </div>
      )}
    </div>
  );
}
