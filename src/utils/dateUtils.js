/**
 * Date utility helpers for student enrollment, 30-day cycles, and multi-month dues calculation
 */

// Format a Date object to YYYY-MM-DD in local time
export function formatDateToISO(date) {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date formatted as YYYY-MM-DD
export function getTodayISO() {
  return formatDateToISO(new Date());
}

// Get the 1st day of current month as YYYY-MM-DD
export function getFirstDayOfCurrentMonthISO() {
  const now = new Date();
  return formatDateToISO(new Date(now.getFullYear(), now.getMonth(), 1));
}

/**
 * Calculates ending date by adding a given number of days (default 30 days)
 * E.g. 1 Month = 30 days, 2 Months = 60 days, 3 Months = 90 days.
 */
export function calculateEndDateByDays(startDateStr, days = 30) {
  if (!startDateStr) return '';
  const parts = startDateStr.split('-').map(Number);
  if (parts.length !== 3) return '';

  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(date.getTime())) return '';

  date.setDate(date.getDate() + Number(days));
  return formatDateToISO(date);
}

// Format a YYYY-MM-DD string into a clean readable date: "25 Oct 2026"
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Calculate exact days between two dates
export function getDaysCount(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const sParts = startDateStr.split('-').map(Number);
  const eParts = endDateStr.split('-').map(Number);

  const s = new Date(sParts[0], sParts[1] - 1, sParts[2]);
  const e = new Date(eParts[0], eParts[1] - 1, eParts[2]);

  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;

  const diffTime = e.getTime() - s.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Comprehensive Dues & Partial Payment Calculator:
 *
 * Handles:
 * 1. Accrued Gross Dues based on elapsed months (e.g. 3 months @ ₹200 = ₹600).
 * 2. Custom partial payments entered by user (e.g. student paid ₹300, remaining dues = ₹300).
 * 3. Advance payments (e.g. student pays more than gross dues).
 * 4. Exact status badges (Overdue, Partially Paid, All Dues Cleared, Active).
 */
export function calculateStudentDuesAndStatus(
  startDateStr,
  endDateStr,
  monthlyFee = 200,
  isPaid = false,
  totalPaidAmount = 0
) {
  const fee = Number(monthlyFee) || 200;
  const paidAmount = Number(totalPaidAmount) || 0;

  if (!startDateStr || !endDateStr) {
    const remaining = Math.max(0, fee - paidAmount);
    return {
      grossAccruedDues: fee,
      totalPaidAmount: paidAmount,
      remainingDues: remaining,
      unpaidMonths: 1,
      isOverdue: false,
      statusBadge: remaining === 0 ? 'All Dues Cleared' : 'Pending',
      badgeType: remaining === 0 ? 'active' : 'warning',
      description: remaining === 0 ? 'Paid' : `₹${remaining} remaining`,
    };
  }

  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const [endYear, endMonthRaw, endDay] = endDateStr.split('-').map(Number);
  const endMid = new Date(endYear, endMonthRaw - 1, endDay).getTime();

  const [startYear, startMonthRaw, startDay] = startDateStr.split('-').map(Number);
  const startMid = new Date(startYear, startMonthRaw - 1, startDay).getTime();

  // Days since start date
  const daysSinceStart = Math.max(0, Math.round((todayMid - startMid) / (1000 * 60 * 60 * 24)));

  // Days past end date (positive means cycle expired)
  const daysPastEnd = Math.round((todayMid - endMid) / (1000 * 60 * 60 * 24));

  // Calculate gross accrued months
  let accruedMonths = 1;
  if (daysPastEnd > 0) {
    accruedMonths = Math.max(1, Math.ceil(daysSinceStart / 30));
  } else {
    const cycleDays = Math.max(30, getDaysCount(startDateStr, endDateStr));
    accruedMonths = Math.max(1, Math.round(cycleDays / 30));
  }

  // Total gross fees accrued so far
  const grossAccruedDues = accruedMonths * fee;

  // Remaining dues after subtracting total payments made
  let remainingDues = 0;
  if (isPaid && paidAmount === 0) {
    // If marked paid historically without explicit amount
    remainingDues = 0;
  } else {
    remainingDues = Math.max(0, grossAccruedDues - paidAmount);
  }

  // Case 1: All dues are fully paid / cleared
  if (remainingDues === 0 && (isPaid || paidAmount >= grossAccruedDues)) {
    const remainingDays = Math.max(0, -daysPastEnd);
    return {
      grossAccruedDues,
      totalPaidAmount: Math.max(paidAmount, grossAccruedDues),
      remainingDues: 0,
      unpaidMonths: 0,
      isOverdue: false,
      statusBadge: 'All Dues Cleared ✓',
      badgeType: 'active',
      description: remainingDays > 0 ? `${remainingDays} days left in cycle` : 'Fully paid',
    };
  }

  // Case 2: Student has paid PART of the money
  if (paidAmount > 0 && remainingDues > 0) {
    const remainingMonths = Math.ceil(remainingDues / fee);
    return {
      grossAccruedDues,
      totalPaidAmount: paidAmount,
      remainingDues,
      unpaidMonths: remainingMonths,
      isOverdue: daysPastEnd > 0,
      statusBadge: `Partially Paid (${fee > 0 ? `${paidAmount}/${grossAccruedDues}` : ''})`,
      badgeType: 'warning',
      description: `Paid ₹${paidAmount} so far · ₹${remainingDues} remaining dues`,
    };
  }

  // Case 3: No money paid yet, check overdue status
  if (daysPastEnd > 0) {
    return {
      grossAccruedDues,
      totalPaidAmount: 0,
      remainingDues: grossAccruedDues,
      unpaidMonths: accruedMonths,
      isOverdue: true,
      statusBadge:
        accruedMonths >= 3
          ? `🚨 ${accruedMonths} Months Overdue`
          : accruedMonths === 2
          ? `⚠️ 2 Months Overdue`
          : `⚠️ 1 Month Overdue`,
      badgeType: accruedMonths >= 2 ? 'critical' : 'warning',
      description: `${accruedMonths} months not submitted (${daysSinceStart} days since start)`,
    };
  }

  // Case 4: First month cycle pending
  const remainingDays = Math.max(0, -daysPastEnd);
  return {
    grossAccruedDues,
    totalPaidAmount: 0,
    remainingDues: grossAccruedDues,
    unpaidMonths: 1,
    isOverdue: false,
    statusBadge: accruedMonths > 1 ? `${accruedMonths} Months Pending` : 'Due This Month',
    badgeType: 'warning',
    description: `${remainingDays} days left in current cycle`,
  };
}
