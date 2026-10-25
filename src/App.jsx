import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Calendar,
  CreditCard,
  Plus,
  Search,
  Trash2,
  Receipt,
  Printer,
  X,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  getTodayISO,
  getFirstDayOfCurrentMonthISO,
  calculateEndDateByDays,
  calculateStudentDuesAndStatus,
  formatDisplayDate,
  getDaysCount,
} from './utils/dateUtils';
import './App.css';

// Realistic sample students demonstrating:
// - Monthly fee: 200
// - Karan Malhotra: 3 months not submitted -> ₹600 dues (can enter custom amount e.g. ₹300 or full ₹600!)
// - Sneha Verma: 2 months not submitted -> ₹400 dues
// - Aryan Gupta: Joined today -> ₹200 dues
// - Priya Sharma: Paid & Active -> ₹0 dues
const SAMPLE_STUDENTS = [
  {
    id: '101',
    name: 'Karan Malhotra',
    startDate: '2026-07-25', // 3 months ago
    endDate: '2026-08-24',
    monthlyFee: 200,
    paid: false,
    totalPaidAmount: 0,
    lastPaymentAmount: null,
    paidAt: null,
    createdAt: '2026-07-25T10:00:00Z',
  },
  {
    id: '102',
    name: 'Sneha Verma',
    startDate: '2026-08-25', // 2 months ago
    endDate: '2026-09-24',
    monthlyFee: 200,
    paid: false,
    totalPaidAmount: 0,
    lastPaymentAmount: null,
    paidAt: null,
    createdAt: '2026-08-25T11:15:00Z',
  },
  {
    id: '103',
    name: 'Aryan Gupta',
    startDate: '2026-10-25', // Joined today
    endDate: '2026-11-24',
    monthlyFee: 200,
    paid: false,
    totalPaidAmount: 0,
    lastPaymentAmount: null,
    paidAt: null,
    createdAt: '2026-10-25T09:00:00Z',
  },
  {
    id: '104',
    name: 'Priya Sharma',
    startDate: '2026-10-10',
    endDate: '2026-11-09',
    monthlyFee: 200,
    paid: true,
    totalPaidAmount: 200,
    lastPaymentAmount: 200,
    paidAt: '2026-10-12 10:30 AM',
    createdAt: '2026-10-10T14:20:00Z',
  },
];

export default function App() {
  // Persistence state
  const [students, setStudents] = useState(() => {
    try {
      const saved = localStorage.getItem('feemanage_students_v5');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved students', e);
    }
    return SAMPLE_STUDENTS;
  });

  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('feemanage_currency') || '₹';
  });

  // Default monthly fee (user configurable, default 200)
  const [defaultMonthlyFee, setDefaultMonthlyFee] = useState(() => {
    const saved = localStorage.getItem('feemanage_monthly_fee');
    return saved ? Number(saved) : 200;
  });

  // Form State
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(getTodayISO);
  const [durationMonths, setDurationMonths] = useState(1); // 1, 2, or 3 months
  const [monthlyFeeInput, setMonthlyFeeInput] = useState('');

  // Individual custom payment input state per student: { [studentId]: string }
  const [customPayAmounts, setCustomPayAmounts] = useState({});

  // Auto-calculated end date from start date and duration (30 days per month)
  const autoEndDate = calculateEndDateByDays(startDate, durationMonths * 30);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'overdue_3', 'overdue_2', 'partial', 'pending', 'paid'

  // Toast / notification
  const [toastMessage, setToastMessage] = useState(null);

  // Active Receipt Modal
  const [receiptData, setReceiptData] = useState(null);

  // Input ref to keep focus for fast typing
  const nameInputRef = useRef(null);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('feemanage_students_v5', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('feemanage_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('feemanage_monthly_fee', String(defaultMonthlyFee));
  }, [defaultMonthlyFee]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Effective fee per month for the form
  const effectiveMonthlyFee = monthlyFeeInput.trim() !== '' ? Number(monthlyFeeInput) : defaultMonthlyFee;

  // Add / Enroll student handler
  const handleEnrollStudent = (e) => {
    if (e) e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      if (nameInputRef.current) nameInputRef.current.focus();
      return;
    }

    const fee = isNaN(effectiveMonthlyFee) || effectiveMonthlyFee <= 0 ? defaultMonthlyFee : effectiveMonthlyFee;
    const effectiveEndDate = autoEndDate || calculateEndDateByDays(startDate, durationMonths * 30);

    const newStudent = {
      id: Date.now().toString(),
      name: trimmedName,
      startDate: startDate,
      endDate: effectiveEndDate,
      monthlyFee: fee,
      paid: false,
      totalPaidAmount: 0,
      lastPaymentAmount: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
    };

    setStudents((prev) => [newStudent, ...prev]);
    setName('');
    setMonthlyFeeInput('');

    setToastMessage(`✓ ${trimmedName} enrolled! Fee: ${currency}${fee}/mo, Period: ${formatDisplayDate(startDate)} to ${formatDisplayDate(effectiveEndDate)}`);

    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  // Handler for custom payment amount entry (user enters any amount paid)
  const handleCustomPayment = (student, currentDues) => {
    const rawVal = customPayAmounts[student.id];
    const amountToPay = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : currentDues.remainingDues;

    if (isNaN(amountToPay) || amountToPay <= 0) {
      alert('Please enter a valid payment amount greater than 0.');
      return;
    }

    const now = new Date();
    const formattedPaidTime = now.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const currentTotalPaid = Number(student.totalPaidAmount || 0);
    const newTotalPaid = currentTotalPaid + amountToPay;
    const grossDues = currentDues.grossAccruedDues;
    const newRemainingDues = Math.max(0, grossDues - newTotalPaid);
    const isNowFullyPaid = newRemainingDues === 0;

    let updatedStartDate = student.startDate;
    let updatedEndDate = student.endDate;

    // If fully paid, advance cycle to current date + 30 days
    if (isNowFullyPaid) {
      updatedStartDate = getTodayISO();
      updatedEndDate = calculateEndDateByDays(updatedStartDate, 30);
    }

    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === student.id) {
          return {
            ...s,
            startDate: updatedStartDate,
            endDate: updatedEndDate,
            paid: isNowFullyPaid,
            totalPaidAmount: newTotalPaid,
            lastPaymentAmount: amountToPay,
            paidAt: formattedPaidTime,
          };
        }
        return s;
      })
    );

    // Clear the custom input field for this student
    setCustomPayAmounts((prev) => ({ ...prev, [student.id]: '' }));

    if (isNowFullyPaid) {
      setToastMessage(`✓ Received ${currency}${amountToPay.toLocaleString()} from ${student.name}. All dues fully cleared!`);
    } else {
      setToastMessage(`✓ Received ${currency}${amountToPay.toLocaleString()} from ${student.name}. Remaining balance: ${currency}${newRemainingDues.toLocaleString()}`);
    }

    // Open receipt
    setReceiptData({
      studentName: student.name,
      id: student.id,
      monthlyFee: student.monthlyFee || defaultMonthlyFee,
      amountPaidToday: amountToPay,
      totalPaidSoFar: newTotalPaid,
      grossAccruedDues: grossDues,
      remainingBalance: newRemainingDues,
      startDate: updatedStartDate,
      endDate: updatedEndDate,
      paidAt: formattedPaidTime,
      status: isNowFullyPaid ? 'Fully Paid' : 'Partially Paid',
    });
  };

  // Quick preset helper to fill amount into the input
  const handleSetQuickAmount = (studentId, amount) => {
    setCustomPayAmounts((prev) => ({
      ...prev,
      [studentId]: String(amount),
    }));
  };

  // Undo / Reset Payment
  const handleUndoPayment = (studentId) => {
    setStudents((prev) =>
      prev.map((student) => {
        if (student.id === studentId) {
          return {
            ...student,
            paid: false,
            totalPaidAmount: 0,
            lastPaymentAmount: null,
            paidAt: null,
          };
        }
        return student;
      })
    );
    setCustomPayAmounts((prev) => ({ ...prev, [studentId]: '' }));
    setToastMessage('Payment reset to unpaid.');
  };

  // Delete student
  const handleDeleteStudent = (studentId, studentName) => {
    if (window.confirm(`Are you sure you want to remove "${studentName}"?`)) {
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setToastMessage(`Removed ${studentName}`);
    }
  };

  // Quick date presets
  const setDatePreset = (preset) => {
    if (preset === 'today') {
      setStartDate(getTodayISO());
    } else if (preset === 'month_start') {
      setStartDate(getFirstDayOfCurrentMonthISO());
    }
  };

  // Calculate dues and status for every student
  const studentsWithDues = students.map((student) => {
    const fee = Number(student.monthlyFee) || defaultMonthlyFee;
    const duesInfo = calculateStudentDuesAndStatus(
      student.startDate,
      student.endDate,
      fee,
      student.paid,
      student.totalPaidAmount || 0
    );

    return {
      ...student,
      monthlyFee: fee,
      duesInfo,
    };
  });

  // Filter groups
  const overdue3MonthsStudents = studentsWithDues.filter(
    (s) => s.duesInfo.remainingDues > 0 && s.duesInfo.unpaidMonths >= 3
  );

  const overdue2MonthsStudents = studentsWithDues.filter(
    (s) => s.duesInfo.remainingDues > 0 && s.duesInfo.unpaidMonths === 2
  );

  const partiallyPaidStudents = studentsWithDues.filter(
    (s) => s.totalPaidAmount > 0 && s.duesInfo.remainingDues > 0
  );

  const allPendingStudents = studentsWithDues.filter(
    (s) => s.duesInfo.remainingDues > 0
  );

  const allPaidStudents = studentsWithDues.filter(
    (s) => s.duesInfo.remainingDues === 0
  );

  // Dashboard Metrics
  const totalCount = studentsWithDues.length;
  const totalFeeCollected = studentsWithDues.reduce(
    (sum, s) => sum + (Number(s.totalPaidAmount) || (s.paid ? s.monthlyFee : 0)),
    0
  );
  const totalOutstandingDues = studentsWithDues.reduce(
    (sum, s) => sum + s.duesInfo.remainingDues,
    0
  );

  // Filtered students for table view
  const filteredStudents = studentsWithDues.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterTab === 'overdue_3') {
      return student.duesInfo.remainingDues > 0 && student.duesInfo.unpaidMonths >= 3;
    }
    if (filterTab === 'overdue_2') {
      return student.duesInfo.remainingDues > 0 && student.duesInfo.unpaidMonths === 2;
    }
    if (filterTab === 'partial') {
      return student.totalPaidAmount > 0 && student.duesInfo.remainingDues > 0;
    }
    if (filterTab === 'pending') {
      return student.duesInfo.remainingDues > 0;
    }
    if (filterTab === 'paid') {
      return student.duesInfo.remainingDues === 0;
    }
    return true;
  });

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Users size={22} />
          </div>
          <div>
            <h1 className="brand-title">Student Fee Register</h1>
            <p className="brand-subtitle">
              Custom payment amounts, multi-month dues calculation (e.g. ₹200/mo × 3 mo = ₹600) & instant receipt generator
            </p>
          </div>
        </div>

        <div className="header-controls">
          {/* Quick Default Monthly Fee Config */}
          <div className="fee-config-wrapper" title="Change standard monthly fee for new enrollments">
            <span>Monthly Fee:</span>
            <div className="fee-config-input-box">
              <span>{currency}</span>
              <input
                type="number"
                value={defaultMonthlyFee}
                onChange={(e) => setDefaultMonthlyFee(Math.max(1, Number(e.target.value)))}
                min="1"
              />
            </div>
          </div>

          <div className="currency-select-wrapper">
            <span>Currency:</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              title="Select Currency"
            >
              <option value="₹">₹ (INR)</option>
              <option value="$">$ (USD)</option>
              <option value="€">€ (EUR)</option>
              <option value="£">£ (GBP)</option>
            </select>
          </div>

          <div className="date-badge">
            <Calendar size={14} />
            <span>Today: {formatDisplayDate(getTodayISO())}</span>
          </div>
        </div>
      </header>

      {/* Critical Overdue Alert Banner */}
      {overdue3MonthsStudents.length > 0 && filterTab !== 'overdue_3' && (
        <div className="overdue-alert-banner">
          <div className="overdue-alert-content">
            <AlertTriangle size={18} />
            <span>
              <strong>Overdue Alert:</strong> {overdue3MonthsStudents.length} {overdue3MonthsStudents.length === 1 ? 'student has' : 'students have'} <strong>3 or more months</strong> not submitted ({currency}{overdue3MonthsStudents.reduce((sum, s) => sum + s.duesInfo.remainingDues, 0).toLocaleString()} pending dues).
            </span>
          </div>
          <button
            type="button"
            className="overdue-alert-btn"
            onClick={() => setFilterTab('overdue_3')}
          >
            Review 3+ Months Overdue
          </button>
        </div>
      )}

      {/* Real-time Dashboard Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper students">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Enrolled</span>
            <span className="stat-value">{totalCount}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper paid">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Fees Collected</span>
            <span className="stat-value">
              {currency}{totalFeeCollected.toLocaleString()}
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({allPaidStudents.length} cleared)
              </span>
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper pending">
            <Clock size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Outstanding Dues</span>
            <span className="stat-value" style={{ color: '#d97706' }}>
              {currency}{totalOutstandingDues.toLocaleString()}
              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({allPendingStudents.length} pending)
              </span>
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon-wrapper ${overdue3MonthsStudents.length > 0 ? 'critical' : 'total'}`}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">3+ Months Overdue</span>
            <span
              className="stat-value"
              style={{ color: overdue3MonthsStudents.length > 0 ? '#dc2626' : 'inherit' }}
            >
              {overdue3MonthsStudents.length} {overdue3MonthsStudents.length === 1 ? 'Student' : 'Students'}
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-banner">
          <div className="toast-content">
            <Sparkles size={16} />
            <span>{toastMessage}</span>
          </div>
          <button className="toast-close" onClick={() => setToastMessage(null)} title="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Enrollment Card */}
      <section className="enrollment-panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <Plus size={19} />
            Enroll New Student
          </h2>
          <p className="panel-desc">
            Type student name and press Enter. Monthly fee defaults to {currency}{defaultMonthlyFee}, start date defaults to today, and end date calculates to exact 30-day cycles.
          </p>
        </div>

        <form onSubmit={handleEnrollStudent} className="enrollment-form">
          <div className="form-row">
            {/* Student Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="student-name">
                Student Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="input-container">
                <input
                  id="student-name"
                  ref={nameInputRef}
                  type="text"
                  className="form-input"
                  placeholder="e.g. Priyanshu Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Starting Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="start-date">
                Starting Date
              </label>
              <input
                id="start-date"
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              <div className="quick-date-chips">
                <button
                  type="button"
                  className={`date-chip ${startDate === getTodayISO() ? 'active' : ''}`}
                  onClick={() => setDatePreset('today')}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`date-chip ${startDate === getFirstDayOfCurrentMonthISO() ? 'active' : ''}`}
                  onClick={() => setDatePreset('month_start')}
                >
                  1st of Month
                </button>
              </div>
            </div>

            {/* Ending Date & Duration Selector */}
            <div className="form-group">
              <label className="form-label">
                Ending Date <span className="label-hint">({durationMonths * 30} Days)</span>
              </label>
              <div className="auto-end-date-box" title="Calculated automatically from starting date">
                <span className="auto-date-value">
                  <Calendar size={15} color="#2563eb" />
                  {formatDisplayDate(autoEndDate)}
                </span>
                <span className="auto-badge">{durationMonths} {durationMonths === 1 ? 'Month (30d)' : 'Months'}</span>
              </div>
              <div className="duration-selector-row">
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration:</span>
                <button
                  type="button"
                  className={`duration-pill-btn ${durationMonths === 1 ? 'active' : ''}`}
                  onClick={() => setDurationMonths(1)}
                >
                  1 Mo (30d)
                </button>
                <button
                  type="button"
                  className={`duration-pill-btn ${durationMonths === 2 ? 'active' : ''}`}
                  onClick={() => setDurationMonths(2)}
                >
                  2 Mo (60d)
                </button>
                <button
                  type="button"
                  className={`duration-pill-btn ${durationMonths === 3 ? 'active' : ''}`}
                  onClick={() => setDurationMonths(3)}
                >
                  3 Mo (90d)
                </button>
              </div>
            </div>

            {/* Monthly Fee Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="fee-amount">
                Monthly Fee <span className="label-hint">({currency}/month)</span>
              </label>
              <input
                id="fee-amount"
                type="number"
                className="form-input"
                placeholder={String(defaultMonthlyFee)}
                value={monthlyFeeInput}
                onChange={(e) => setMonthlyFeeInput(e.target.value)}
                min="1"
              />
            </div>
          </div>

          <div className="form-actions-row">
            <div className="enrollment-summary-pill">
              <span>Enrollment Period:</span>
              <strong>{formatDisplayDate(startDate)}</strong>
              <ArrowRight size={13} />
              <strong>{formatDisplayDate(autoEndDate)}</strong>
              <span style={{ color: '#2563eb', fontWeight: '600' }}>
                ({durationMonths * 30} Days — {currency}{effectiveMonthlyFee}/month)
              </span>
            </div>

            <button type="submit" className="btn-primary">
              <Plus size={16} />
              <span>Enroll Student</span>
              <span className="btn-shortcut-hint">Enter ↵</span>
            </button>
          </div>
        </form>
      </section>

      {/* Enrolled Students & Fee Management */}
      <section className="students-section">
        <div className="section-toolbar">
          {/* Filter Pills */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              All Students
              <span className="filter-count">{totalCount}</span>
            </button>

            {overdue3MonthsStudents.length > 0 && (
              <button
                className={`filter-tab critical-tab ${filterTab === 'overdue_3' ? 'active' : ''}`}
                onClick={() => setFilterTab('overdue_3')}
              >
                🚨 3+ Months Overdue
                <span className="filter-count critical">{overdue3MonthsStudents.length}</span>
              </button>
            )}

            {overdue2MonthsStudents.length > 0 && (
              <button
                className={`filter-tab critical-tab ${filterTab === 'overdue_2' ? 'active' : ''}`}
                onClick={() => setFilterTab('overdue_2')}
              >
                ⚠️ 2 Months Overdue
                <span className="filter-count critical">{overdue2MonthsStudents.length}</span>
              </button>
            )}

            {partiallyPaidStudents.length > 0 && (
              <button
                className={`filter-tab ${filterTab === 'partial' ? 'active' : ''}`}
                onClick={() => setFilterTab('partial')}
              >
                Partially Paid
                <span className="filter-count">{partiallyPaidStudents.length}</span>
              </button>
            )}

            <button
              className={`filter-tab ${filterTab === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterTab('pending')}
            >
              Pending Dues
              <span className="filter-count">{allPendingStudents.length}</span>
            </button>
            <button
              className={`filter-tab ${filterTab === 'paid' ? 'active' : ''}`}
              onClick={() => setFilterTab('paid')}
            >
              All Cleared
              <span className="filter-count">{allPaidStudents.length}</span>
            </button>
          </div>

          {/* Search by student name */}
          <div className="toolbar-search">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="table-card">
          {filteredStudents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Users size={24} />
              </div>
              <h3 className="empty-title">No students found</h3>
              <p className="empty-desc">
                {searchQuery
                  ? `No student matching "${searchQuery}". Clear your search to see all.`
                  : filterTab === 'overdue_3'
                  ? 'No student has 3 or more months overdue.'
                  : filterTab === 'overdue_2'
                  ? 'No student has 2 months overdue.'
                  : filterTab === 'partial'
                  ? 'No student with partial payments.'
                  : filterTab === 'pending'
                  ? 'All enrolled students have cleared their fees!'
                  : 'No students enrolled yet. Add a student using the form above.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Monthly Fee</th>
                    <th>Enrollment Period</th>
                    <th>Status & Months Due</th>
                    <th>Remaining Dues</th>
                    <th>Enter Amount & Pay</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const days = getDaysCount(student.startDate, student.endDate);
                    const initials = student.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    const dues = student.duesInfo;
                    const isMultiMonthOverdue = dues.remainingDues > 0 && dues.unpaidMonths >= 2;
                    const hasDues = dues.remainingDues > 0;

                    // Current input amount for this student
                    const currentInputAmount =
                      customPayAmounts[student.id] !== undefined
                        ? customPayAmounts[student.id]
                        : String(dues.remainingDues);

                    return (
                      <tr
                        key={student.id}
                        className={isMultiMonthOverdue ? 'row-overdue-critical' : ''}
                      >
                        {/* Student Name & Avatar */}
                        <td>
                          <div className="student-cell">
                            <div className="student-avatar">{initials}</div>
                            <div className="student-name-box">
                              <span className="student-name">{student.name}</span>
                              <span className="student-subtext">
                                ID #{student.id.slice(-4)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Monthly Fee */}
                        <td>
                          <span style={{ fontWeight: '600', color: '#1e293b' }}>
                            {currency}{Number(student.monthlyFee).toLocaleString()}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: '2px' }}>
                            /mo
                          </span>
                        </td>

                        {/* Starting Date -> Ending Date */}
                        <td>
                          <div className="period-cell">
                            <div className="period-dates">
                              <span>{formatDisplayDate(student.startDate)}</span>
                              <span className="period-arrow">➔</span>
                              <span>{formatDisplayDate(student.endDate)}</span>
                            </div>
                            <div className="period-meta">
                              <span className="month-end-tag">{days} Days</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge & Unpaid Months */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className={`status-pill ${dues.badgeType}`}>
                              <span className="status-dot"></span>
                              {dues.statusBadge}
                            </span>
                            <span className={`comparison-note ${isMultiMonthOverdue ? 'danger-text' : ''}`}>
                              {dues.description}
                            </span>
                          </div>
                        </td>

                        {/* Remaining Dues Calculation */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong
                              style={{
                                fontSize: '16px',
                                color: hasDues ? (isMultiMonthOverdue ? '#dc2626' : '#d97706') : '#059669',
                              }}
                            >
                              {currency}{dues.remainingDues.toLocaleString()}
                            </strong>

                            {/* Detailed breakdown if multi-month or partial payment */}
                            {dues.grossAccruedDues > student.monthlyFee && (
                              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                Total: {currency}{dues.grossAccruedDues.toLocaleString()} ({dues.unpaidMonths} mo)
                              </span>
                            )}

                            {student.totalPaidAmount > 0 && (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                                Paid: {currency}{student.totalPaidAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Enter Amount & Pay */}
                        <td>
                          {hasDues ? (
                            <div className="pay-amount-box">
                              <div className="pay-input-wrapper">
                                <span className="pay-input-prefix">{currency}</span>
                                <input
                                  type="number"
                                  className="pay-custom-input"
                                  placeholder="Amount"
                                  value={currentInputAmount}
                                  onChange={(e) =>
                                    setCustomPayAmounts((prev) => ({
                                      ...prev,
                                      [student.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleCustomPayment(student, dues);
                                    }
                                  }}
                                  min="1"
                                  title="Enter amount student paid (e.g. partial or full dues)"
                                />
                                <button
                                  type="button"
                                  className="btn-pay-submit"
                                  onClick={() => handleCustomPayment(student, dues)}
                                  title={`Record payment for ${student.name}`}
                                >
                                  <Check size={13} />
                                  Pay
                                </button>
                              </div>

                              {/* Quick chips to fill 1 month or full dues */}
                              <div className="quick-pay-chips">
                                {dues.remainingDues > student.monthlyFee && (
                                  <button
                                    type="button"
                                    className="quick-pay-chip"
                                    onClick={() => handleSetQuickAmount(student.id, student.monthlyFee)}
                                    title={`Pay 1 month (${currency}${student.monthlyFee})`}
                                  >
                                    1 Mo ({currency}{student.monthlyFee})
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="quick-pay-chip"
                                  onClick={() => handleSetQuickAmount(student.id, dues.remainingDues)}
                                  title={`Pay full remaining balance (${currency}${dues.remainingDues})`}
                                >
                                  Full ({currency}{dues.remainingDues})
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="paid-action-group">
                              <button
                                type="button"
                                className="btn-receipt"
                                onClick={() =>
                                  setReceiptData({
                                    studentName: student.name,
                                    id: student.id,
                                    monthlyFee: student.monthlyFee,
                                    amountPaidToday: student.lastPaymentAmount || student.totalPaidAmount || student.monthlyFee,
                                    totalPaidSoFar: student.totalPaidAmount || student.monthlyFee,
                                    grossAccruedDues: dues.grossAccruedDues,
                                    remainingBalance: 0,
                                    startDate: student.startDate,
                                    endDate: student.endDate,
                                    paidAt: student.paidAt,
                                    status: 'All Dues Cleared',
                                  })
                                }
                                title="View & Print Payment Receipt"
                              >
                                <Receipt size={13} />
                                Receipt
                              </button>
                              <button
                                type="button"
                                className="btn-undo-pay"
                                onClick={() => handleUndoPayment(student.id)}
                                title="Mark as unpaid if clicked by mistake"
                              >
                                Undo
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Row Options */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn-icon-subtle delete"
                              onClick={() => handleDeleteStudent(student.id, student.name)}
                              title="Remove Student"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Printable Fee Receipt Modal */}
      {receiptData && (
        <div className="modal-overlay" onClick={() => setReceiptData(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Fee Payment Receipt</h3>
              <button
                className="modal-close-btn"
                onClick={() => setReceiptData(null)}
                title="Close receipt"
              >
                <X size={18} />
              </button>
            </div>

            <div className="receipt-slip" id="printable-receipt">
              <div className="receipt-watermark">
                <h2 className="receipt-logo-title">Fee Management Receipt</h2>
                <p className="receipt-tagline">Official Tuition & Enrollment Acknowledgment</p>
                <div className="receipt-status-stamp">✓ Payment Confirmed</div>
              </div>

              <div className="receipt-details-list">
                <div className="receipt-row">
                  <span className="receipt-label">Receipt Number:</span>
                  <span className="receipt-value" style={{ fontFamily: 'var(--font-mono)' }}>
                    REC-{receiptData.id.slice(-6)}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Student Name:</span>
                  <span className="receipt-value">{receiptData.studentName}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Monthly Fee Rate:</span>
                  <span className="receipt-value">{currency}{receiptData.monthlyFee} / month</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Payment Date & Time:</span>
                  <span className="receipt-value">{receiptData.paidAt || 'Recorded'}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Payment Status:</span>
                  <span className="receipt-value" style={{ color: '#059669', fontWeight: '700' }}>
                    {receiptData.status}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label" style={{ fontSize: '15px', fontWeight: '600' }}>
                    Amount Paid Today:
                  </span>
                  <span className="receipt-total-value">
                    {currency}{Number(receiptData.amountPaidToday).toLocaleString()}
                  </span>
                </div>
                {receiptData.remainingBalance > 0 && (
                  <div className="receipt-row">
                    <span className="receipt-label" style={{ color: '#dc2626', fontWeight: '600' }}>
                      Remaining Balance Due:
                    </span>
                    <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '15px' }}>
                      {currency}{Number(receiptData.remainingBalance).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReceiptData(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
