import React, { useState } from 'react';
import {
  Briefcase,
  Users,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  Phone,
  Mail,
  UserCheck,
  X,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface RecruitmentTabProps {
  jobs: any[];
  candidates: any[];
  departments: any[];
  onCreateJob: (data: any) => Promise<void>;
  onCreateCandidate: (data: any) => Promise<void>;
  onUpdateStage: (id: string, stage: string, notes: string) => Promise<void>;
  onHireCandidate: (id: string, employeeData: any) => Promise<void>;
}

export const RecruitmentTab: React.FC<RecruitmentTabProps> = ({
  jobs,
  candidates,
  departments,
  onCreateJob,
  onCreateCandidate,
  onUpdateStage,
  onHireCandidate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'candidates' | 'jobs'>('candidates');
  const [selectedJobFilter, setSelectedJobFilter] = useState('');

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({
    title: '',
    department: departments[0]?.name || 'Showroom Sales',
    vacancies: 1,
    experience_required: '1-2 Years in retail/perfume',
    status: 'open',
  });

  const [showCandModal, setShowCandModal] = useState(false);
  const [candForm, setCandForm] = useState({
    job_id: jobs[0]?.id || '',
    name: '',
    phone: '',
    email: '',
    resume_url: '',
    source: 'Facebook / Walk-in',
  });

  const [hiringCand, setHiringCand] = useState<any | null>(null);
  const [hireForm, setHireForm] = useState({
    base_salary: 25000,
    designation: '',
    department: '',
    joining_date: new Date().toISOString().slice(0, 10),
  });

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateJob(jobForm);
      setShowJobModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create job');
    }
  };

  const handleCreateCand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateCandidate(candForm);
      setShowCandModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add candidate');
    }
  };

  const handleStageChange = async (candId: string, stage: string) => {
    try {
      await onUpdateStage(candId, stage, `Stage updated to ${stage}`);
    } catch (err: any) {
      alert(err.message || 'Stage update failed');
    }
  };

  const handleHireSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hiringCand) return;
    try {
      await onHireCandidate(hiringCand.id, {
        name: hiringCand.name,
        phone: hiringCand.phone,
        email: hiringCand.email,
        base_salary: hireForm.base_salary,
        designation: hireForm.designation || hiringCand.job_title || 'Sales Executive',
        department: hireForm.department || 'Showroom Sales',
        joining_date: hireForm.joining_date,
      });
      setHiringCand(null);
      alert(`${hiringCand.name} has been hired and enrolled in the Employee Master!`);
    } catch (err: any) {
      alert(err.message || 'Hiring conversion failed');
    }
  };

  const stages = ['applied', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected'];

  const filteredCandidates = candidates.filter(c => {
    return !selectedJobFilter || c.job_id === selectedJobFilter;
  });

  return (
    <div className="space-y-6">
      {/* Subtab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('candidates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'candidates'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Candidate Applicant Pipeline</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-800 text-[10px]">
              {candidates.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSubTab('jobs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'jobs'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span>Job Openings</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-800 text-[10px]">
              {jobs.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJobModal(true)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition"
          >
            + Post New Opening
          </button>
          <button
            onClick={() => setShowCandModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Candidate
          </button>
        </div>
      </div>

      {activeSubTab === 'candidates' ? (
        <div className="space-y-4">
          {/* Job Filter */}
          <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-stone-200 text-xs">
            <span className="text-stone-500 font-semibold">Filter Opening:</span>
            <select
              value={selectedJobFilter}
              onChange={e => setSelectedJobFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-stone-300 bg-white"
            >
              <option value="">All Openings</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.department})
                </option>
              ))}
            </select>
          </div>

          {/* Kanban / Pipeline Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {stages.map(stage => {
              const stageCands = filteredCandidates.filter(c => c.stage === stage);
              return (
                <div key={stage} className="bg-stone-50 rounded-xl border border-stone-200 p-3 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                    <span className="font-bold text-xs text-stone-900 capitalize">{stage}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 text-stone-700 font-bold">
                      {stageCands.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                    {stageCands.map(cand => (
                      <div
                        key={cand.id}
                        className="bg-white p-3 rounded-lg border border-stone-200 shadow-xs space-y-2 text-xs"
                      >
                        <div className="font-bold text-stone-900">{cand.name}</div>
                        <div className="text-[11px] text-stone-500">{cand.job_title || 'General Applicant'}</div>
                        <div className="text-[11px] text-stone-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{cand.phone}</span>
                        </div>

                        {/* Stage Selector */}
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                          <select
                            value={cand.stage}
                            onChange={e => handleStageChange(cand.id, e.target.value)}
                            className="text-[10px] px-1.5 py-0.5 rounded border border-stone-200 bg-stone-50 font-semibold"
                          >
                            {stages.map(s => (
                              <option key={s} value={s}>
                                Move to: {s}
                              </option>
                            ))}
                          </select>

                          {cand.stage !== 'hired' && (
                            <button
                              onClick={() => {
                                setHiringCand(cand);
                                setHireForm({
                                  base_salary: 25000,
                                  designation: cand.job_title || 'Sales Executive',
                                  department: 'Showroom Sales',
                                  joining_date: new Date().toISOString().slice(0, 10),
                                });
                              }}
                              className="text-[10px] px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
                            >
                              Hire
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Jobs Subtab */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-stone-900 text-sm">{job.title}</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  {job.status}
                </span>
              </div>
              <div className="text-xs text-stone-500 font-medium">{job.department}</div>
              <div className="space-y-1 text-xs text-stone-700 border-t border-stone-100 pt-2">
                <div className="flex justify-between">
                  <span>Open Vacancies:</span>
                  <span className="font-bold text-stone-900">{job.vacancies}</span>
                </div>
                <div className="flex justify-between">
                  <span>Required Experience:</span>
                  <span className="font-medium text-stone-900">{job.experience_required}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Post Job Opening</h3>
              <button onClick={() => setShowJobModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateJob} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Fragrance Consultant"
                  value={jobForm.title}
                  onChange={e => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Department</label>
                <select
                  value={jobForm.department}
                  onChange={e => setJobForm({ ...jobForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Vacancies</label>
                <input
                  type="number"
                  min={1}
                  value={jobForm.vacancies}
                  onChange={e => setJobForm({ ...jobForm, vacancies: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Experience Required</label>
                <input
                  type="text"
                  placeholder="e.g. 1-2 Years Retail Sales"
                  value={jobForm.experience_required}
                  onChange={e => setJobForm({ ...jobForm, experience_required: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Publish Opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showCandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">Add Applicant</h3>
              <button onClick={() => setShowCandModal(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCand} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Applying For *</label>
                <select
                  value={candForm.job_id}
                  onChange={e => setCandForm({ ...candForm, job_id: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300 bg-white"
                >
                  {jobs.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Candidate Full Name *</label>
                <input
                  type="text"
                  required
                  value={candForm.name}
                  onChange={e => setCandForm({ ...candForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={candForm.phone}
                  onChange={e => setCandForm({ ...candForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={candForm.email}
                  onChange={e => setCandForm({ ...candForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCandModal(false)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-stone-900 text-white rounded font-bold hover:bg-stone-800">
                  Save Applicant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Candidate to Employee Modal */}
      {hiringCand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-stone-200">
            <div className="p-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-bold text-sm text-stone-900">
                Hire & Onboard: {hiringCand.name}
              </h3>
              <button onClick={() => setHiringCand(null)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleHireSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900">
                <p className="font-bold">One-Click Employee Enrollment:</p>
                <p className="text-[11px] mt-1">
                  Enrolling this candidate will instantly create their official Employee profile, initialize leave
                  entitlements, and set them active for attendance and payroll.
                </p>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Designation Title</label>
                <input
                  type="text"
                  required
                  value={hireForm.designation}
                  onChange={e => setHireForm({ ...hireForm, designation: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Base Monthly Salary (৳) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={hireForm.base_salary}
                  onChange={e => setHireForm({ ...hireForm, base_salary: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">Joining Date</label>
                <input
                  type="date"
                  required
                  value={hireForm.joining_date}
                  onChange={e => setHireForm({ ...hireForm, joining_date: e.target.value })}
                  className="w-full px-3 py-2 rounded border border-stone-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setHiringCand(null)}
                  className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-600">
                  Confirm Hire & Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
