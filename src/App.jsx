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
  Download,
  Smartphone,
  Share2,
} from 'lucide-react';
import {
  formatDateToISO,
  getTodayISO,
  getFirstDayOfCurrentMonthISO,
  getLastDayOfMonthISO,
  calculateEndDateByMonths,
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sanitize any existing student whose endDate equaled the starting day due to legacy 30-day bug
          return parsed.map((s) => {
            if (s.startDate && s.endDate) {
              const sDay = s.startDate.split('-')[2];
              const eDay = s.endDate.split('-')[2];
              if (sDay === eDay) {
                const [ey, em, ed] = s.endDate.split('-').map(Number);
                const correctedEnd = new Date(ey, em - 1, ed - 1);
                return {
                  ...s,
                  endDate: formatDateToISO(correctedEnd),
                };
              }
            }
            return s;
          });
        }
      }
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
  const [endDate, setEndDate] = useState(() => calculateEndDateByMonths(getTodayISO(), 1));
  const [isCustomEndDate, setIsCustomEndDate] = useState(false);
  const [monthlyFeeInput, setMonthlyFeeInput] = useState('');

  // Individual custom payment input state per student: { [studentId]: string }
  const [customPayAmounts, setCustomPayAmounts] = useState({});

  // Effective end date from start date and duration (ends on the last day, NOT starting day)
  const effectiveFormEndDate = endDate || calculateEndDateByMonths(startDate, durationMonths);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'overdue_3', 'overdue_2', 'partial', 'pending', 'paid'

  // Toast / notification
  const [toastMessage, setToastMessage] = useState(null);

  // Active Receipt Modal
  const [receiptData, setReceiptData] = useState(null);

  // Input ref to keep focus for fast typing
  const nameInputRef = useRef(null);

  // PWA Device Installation States
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  // Detect PWA installability and listen for installation triggers
  useEffect(() => {
    // 1. Check if already running in installed standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    // 3. Show install option when entering website (unless dismissed in this session)
    const isDismissed = sessionStorage.getItem('feemanage_install_dismissed') === 'true';
    if (!isDismissed) {
      // Show immediately or after short gentle intro delay
      const introTimer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 700);

      const handleBeforeInstall = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShowInstallBanner(true);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setShowInstallBanner(false);
        setDeferredPrompt(null);
        setToastMessage('🎉 FeeManage app installed to your device successfully!');
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        clearTimeout(introTimer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  // Action: Trigger Device Install
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setShowInstallBanner(false);
          setToastMessage('🎉 Installing FeeManage to your device...');
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    } else {
      // Fallback instructions for browsers that already triggered or don't support beforeinstallprompt
      setShowIosModal(true);
    }
  };

  // Action: Dismiss Install Banner
  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem('feemanage_install_dismissed', 'true');
  };

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
    const effectiveEndDate = endDate || calculateEndDateByMonths(startDate, durationMonths);

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

    // Reset date picker to today and standard month end
    const today = getTodayISO();
    setStartDate(today);
    setEndDate(calculateEndDateByMonths(today, 1));
    setIsCustomEndDate(false);
    setDurationMonths(1);

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

    // If fully paid, advance cycle so ending date is the last day, not starting day
    if (isNowFullyPaid) {
      const today = getTodayISO();
      if (student.startDate && student.startDate.endsWith('-01')) {
        // Was on 1st-of-month calendar cycle, advance to next month 1st -> last day
        const [curEndYear, curEndMonth] = (student.endDate || today).split('-').map(Number);
        const nextMonthStart = new Date(curEndYear, curEndMonth, 1);
        updatedStartDate = formatDateToISO(nextMonthStart);
        updatedEndDate = calculateEndDateByMonths(updatedStartDate, 1);
      } else {
        updatedStartDate = today;
        updatedEndDate = calculateEndDateByMonths(updatedStartDate, 1);
      }
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

  // Handle start date input change
  const handleStartDateChange = (newStartDate) => {
    setStartDate(newStartDate);
    if (!isCustomEndDate) {
      setEndDate(calculateEndDateByMonths(newStartDate, durationMonths));
    }
  };

  // Quick date presets for Start Date
  const setDatePreset = (preset) => {
    if (preset === 'today') {
      const today = getTodayISO();
      setStartDate(today);
      if (!isCustomEndDate) {
        setEndDate(calculateEndDateByMonths(today, durationMonths));
      }
    } else if (preset === 'month_start') {
      const monthStart = getFirstDayOfCurrentMonthISO();
      setStartDate(monthStart);
      // When starting on 1st of month, end date automatically defaults to the last day of the month
      setEndDate(calculateEndDateByMonths(monthStart, durationMonths));
      setIsCustomEndDate(false);
    }
  };

  // Quick presets for Ending Date
  const handleSetEndDatePreset = (preset) => {
    if (preset === 'month_end') {
      setEndDate(getLastDayOfMonthISO(startDate));
      setIsCustomEndDate(true);
    } else if (preset === '1_month') {
      setDurationMonths(1);
      setEndDate(calculateEndDateByMonths(startDate, 1));
      setIsCustomEndDate(false);
    } else if (preset === '2_months') {
      setDurationMonths(2);
      setEndDate(calculateEndDateByMonths(startDate, 2));
      setIsCustomEndDate(false);
    } else if (preset === '3_months') {
      setDurationMonths(3);
      setEndDate(calculateEndDateByMonths(startDate, 3));
      setIsCustomEndDate(false);
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
      {/* PWA Device Install Banner (Displayed when user enters the website) */}
      {showInstallBanner && !isInstalled && (
        <aside className="install-app-banner" aria-label="Install App Prompt">
          <div className="install-banner-left">
            <div className="install-app-icon">
              <img src="/icon.svg" alt="FeeManage Icon" width="38" height="38" />
            </div>
            <div className="install-banner-text">
              <div className="install-banner-title">
                <span>Install FeeManage on your device</span>
                <span className="install-pill-tag">Offline App</span>
              </div>
              <p className="install-banner-desc">
                Install to your phone or PC for 1-tap home screen access & instant fee tracking.
              </p>
            </div>
          </div>
          <div className="install-banner-actions">
            <button
              type="button"
              className="btn-install-primary"
              onClick={handleInstallClick}
              title="Install FeeManage App"
            >
              <Download size={15} />
              <span>Install App</span>
            </button>
            <button
              type="button"
              className="btn-install-dismiss"
              onClick={handleDismissInstall}
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X size={16} />
            </button>
          </div>
        </aside>
      )}

      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Users size={22} />
          </div>
          <div className="brand-text-block">
            <h1 className="brand-title">Student Fee Register</h1>
            <p className="brand-subtitle">
              Custom payment amounts, multi-month dues calculation (e.g. {currency}200/mo × 3 mo = {currency}600) & instant receipt generator
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

          {/* Install Option in Header */}
          {!isInstalled ? (
            <button
              type="button"
              className="btn-header-install"
              onClick={handleInstallClick}
              title="Install FeeManage to your phone or desktop"
            >
              <Smartphone size={14} />
              <span>Install App</span>
            </button>
          ) : (
            <div className="app-installed-badge" title="Running in standalone app mode">
              <CheckCircle2 size={13} color="#059669" />
              <span>Installed</span>
            </div>
          )}
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
              <span className="stat-subtext">
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
              <span className="stat-subtext">
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
            Type student name and press Enter. Monthly fee defaults to {currency}{defaultMonthlyFee}, start date defaults to today or 1st of month, and ending date calculates to the last day of the fee period.
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
                onChange={(e) => handleStartDateChange(e.target.value)}
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

            {/* Ending Date & Presets */}
            <div className="form-group">
              <label className="form-label" htmlFor="end-date">
                Ending Date <span className="label-hint">(Last day of fee period)</span>
              </label>
              <input
                id="end-date"
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setIsCustomEndDate(true);
                }}
                required
              />
              <div className="quick-date-chips">
                <button
                  type="button"
                  className={`date-chip ${endDate === getLastDayOfMonthISO(startDate) ? 'active' : ''}`}
                  onClick={() => handleSetEndDatePreset('month_end')}
                  title="Ends on the last day of the month"
                >
                  Last Day of Month
                </button>
                <button
                  type="button"
                  className={`date-chip ${!isCustomEndDate && durationMonths === 1 ? 'active' : ''}`}
                  onClick={() => handleSetEndDatePreset('1_month')}
                >
                  1 Mo
                </button>
                <button
                  type="button"
                  className={`date-chip ${!isCustomEndDate && durationMonths === 2 ? 'active' : ''}`}
                  onClick={() => handleSetEndDatePreset('2_months')}
                >
                  2 Mo
                </button>
                <button
                  type="button"
                  className={`date-chip ${!isCustomEndDate && durationMonths === 3 ? 'active' : ''}`}
                  onClick={() => handleSetEndDatePreset('3_months')}
                >
                  3 Mo
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
              <strong>{formatDisplayDate(effectiveFormEndDate)}</strong>
              <span style={{ color: '#2563eb', fontWeight: '600' }}>
                ({getDaysCount(startDate, effectiveFormEndDate, true)} Days — {currency}{effectiveMonthlyFee}/month)
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
            <>
              {/* Desktop Table View (Hidden on mobile phones <= 768px) */}
              <div className="desktop-table-view" style={{ overflowX: 'auto' }}>
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
                      const days = getDaysCount(student.startDate, student.endDate, true);
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

              {/* Mobile Cards View (Visible on mobile phones <= 768px) */}
              <div className="mobile-cards-view">
                {filteredStudents.map((student) => {
                  const days = getDaysCount(student.startDate, student.endDate, true);
                  const initials = student.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  const dues = student.duesInfo;
                  const isMultiMonthOverdue = dues.remainingDues > 0 && dues.unpaidMonths >= 2;
                  const hasDues = dues.remainingDues > 0;

                  const currentInputAmount =
                    customPayAmounts[student.id] !== undefined
                      ? customPayAmounts[student.id]
                      : String(dues.remainingDues);

                  return (
                    <div
                      key={student.id}
                      className={`mobile-student-card ${isMultiMonthOverdue ? 'overdue-card' : ''}`}
                    >
                      {/* Card Header: Avatar, Name, Status Badge */}
                      <div className="mobile-card-header">
                        <div className="mobile-student-info">
                          <div className="mobile-avatar">{initials}</div>
                          <div className="mobile-name-box">
                            <span className="mobile-name">{student.name}</span>
                            <span className="mobile-id">ID #{student.id.slice(-4)}</span>
                          </div>
                        </div>
                        <span className={`status-pill ${dues.badgeType}`}>
                          <span className="status-dot"></span>
                          {dues.statusBadge}
                        </span>
                      </div>

                      {/* Card Meta Grid: Fee & Cycle */}
                      <div className="mobile-meta-grid">
                        <div className="mobile-meta-item">
                          <span className="mobile-meta-label">Monthly Rate</span>
                          <span className="mobile-meta-val">
                            {currency}{Number(student.monthlyFee).toLocaleString()} /mo
                          </span>
                        </div>
                        <div className="mobile-meta-item">
                          <span className="mobile-meta-label">Cycle ({days} Days)</span>
                          <span className="mobile-meta-val">
                            {formatDisplayDate(student.startDate)} ➔ {formatDisplayDate(student.endDate)}
                          </span>
                        </div>
                      </div>

                      {/* Dues Highlight Box */}
                      <div
                        className={`mobile-dues-box ${
                          isMultiMonthOverdue ? 'critical' : hasDues ? '' : 'cleared'
                        }`}
                      >
                        <div className="mobile-dues-label-col">
                          <span className="mobile-dues-title">
                            {hasDues ? 'Remaining Dues' : 'Fee Status'}
                          </span>
                          <span className="mobile-dues-sub">
                            {hasDues ? dues.description : 'All dues cleared for this cycle'}
                          </span>
                        </div>
                        <span className="mobile-dues-amount">
                          {currency}{dues.remainingDues.toLocaleString()}
                        </span>
                      </div>

                      {/* Payment Section */}
                      {hasDues ? (
                        <div className="mobile-pay-section">
                          <div className="mobile-pay-input-row">
                            <div className="mobile-pay-input-box">
                              <span className="pay-input-prefix">{currency}</span>
                              <input
                                type="number"
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
                              />
                            </div>
                            <button
                              type="button"
                              className="mobile-btn-pay"
                              onClick={() => handleCustomPayment(student, dues)}
                            >
                              <Check size={16} />
                              Pay
                            </button>
                          </div>

                          {/* Quick Tap Chips */}
                          <div className="mobile-quick-chips">
                            {dues.remainingDues > student.monthlyFee && (
                              <button
                                type="button"
                                className="mobile-quick-chip"
                                onClick={() =>
                                  handleSetQuickAmount(student.id, student.monthlyFee)
                                }
                              >
                                1 Mo ({currency}{student.monthlyFee})
                              </button>
                            )}
                            <button
                              type="button"
                              className="mobile-quick-chip"
                              onClick={() =>
                                handleSetQuickAmount(student.id, dues.remainingDues)
                              }
                            >
                              Full ({currency}{dues.remainingDues})
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="paid-action-group" style={{ justifyContent: 'space-between' }}>
                          <button
                            type="button"
                            className="btn-receipt"
                            onClick={() =>
                              setReceiptData({
                                studentName: student.name,
                                id: student.id,
                                monthlyFee: student.monthlyFee,
                                amountPaidToday:
                                  student.lastPaymentAmount ||
                                  student.totalPaidAmount ||
                                  student.monthlyFee,
                                totalPaidSoFar:
                                  student.totalPaidAmount || student.monthlyFee,
                                grossAccruedDues: dues.grossAccruedDues,
                                remainingBalance: 0,
                                startDate: student.startDate,
                                endDate: student.endDate,
                                paidAt: student.paidAt,
                                status: 'All Dues Cleared',
                              })
                            }
                          >
                            <Receipt size={14} />
                            View Receipt
                          </button>
                          <button
                            type="button"
                            className="btn-undo-pay"
                            onClick={() => handleUndoPayment(student.id)}
                          >
                            Undo
                          </button>
                        </div>
                      )}

                      {/* Card Footer: Remove */}
                      <div className="mobile-card-footer">
                        <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                          Enrolled: {formatDisplayDate(student.startDate)}
                        </span>
                        <button
                          type="button"
                          className="btn-icon-subtle delete"
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          title="Remove Student"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
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
                {receiptData.startDate && receiptData.endDate && (
                  <div className="receipt-row">
                    <span className="receipt-label">Covered Fee Period:</span>
                    <span className="receipt-value" style={{ fontWeight: '600' }}>
                      {formatDisplayDate(receiptData.startDate)} ➔ {formatDisplayDate(receiptData.endDate)}
                    </span>
                  </div>
                )}
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

      {/* iOS & Manual Installation Guide Modal */}
      {showIosModal && (
        <div className="modal-overlay" onClick={() => setShowIosModal(false)}>
          <div className="modal-card ios-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={18} color="#2563eb" />
                <h3 className="modal-title">Install on Device</h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowIosModal(false)}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="ios-install-body">
              <div className="ios-install-app-preview">
                <img src="/icon.svg" alt="FeeManage Icon" width="48" height="48" />
                <div>
                  <strong>FeeManage App</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Add to your Home Screen for full app experience
                  </p>
                </div>
              </div>

              {isIos ? (
                <>
                  <p className="ios-install-intro">
                    On iPhone / iPad Safari, install in 3 simple steps:
                  </p>
                  <div className="ios-steps-list">
                    <div className="ios-step-item">
                      <div className="ios-step-num">1</div>
                      <div className="ios-step-text">
                        Tap the <strong>Share</strong> button <Share2 size={14} className="inline-icon" /> in Safari's bottom toolbar.
                      </div>
                    </div>
                    <div className="ios-step-item">
                      <div className="ios-step-num">2</div>
                      <div className="ios-step-text">
                        Scroll down and tap <strong>"Add to Home Screen"</strong> with the <Plus size={14} className="inline-icon" /> icon.
                      </div>
                    </div>
                    <div className="ios-step-item">
                      <div className="ios-step-num">3</div>
                      <div className="ios-step-text">
                        Tap <strong>"Add"</strong> in the top-right corner to finish.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="ios-install-intro">
                    To install on Android, Chrome, or Windows PC:
                  </p>
                  <div className="ios-steps-list">
                    <div className="ios-step-item">
                      <div className="ios-step-num">1</div>
                      <div className="ios-step-text">
                        Open your browser menu (<strong>⋮</strong> or <strong>⋯</strong> in top-right).
                      </div>
                    </div>
                    <div className="ios-step-item">
                      <div className="ios-step-num">2</div>
                      <div className="ios-step-text">
                        Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                      </div>
                    </div>
                    <div className="ios-step-item">
                      <div className="ios-step-num">3</div>
                      <div className="ios-step-text">
                        Confirm <strong>"Install"</strong> to launch directly from your home screen or desktop.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowIosModal(false)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
