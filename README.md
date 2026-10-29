# FeeManage — Student Enrollment & Fee Register

A modern, responsive React web application designed for tutors, coaching institutes, and schools to enroll students and manage recurring fee payments.

## Features

- **Quick Student Enrollment**: Enroll students by entering just their name (press `Enter ↵` to quickly add multiple students).
- **Exact 30-Day Billing Cycles**: Automatically calculates 30-day, 60-day (2 mo), or 90-day (3 mo) periods from the start date.
- **Accrued Multi-Month Dues Detection**:
  - Automatically compares enrollment ending dates with the current date/month.
  - Identifies students who have not submitted fees for 1 month, 2 months, 3+ months.
  - Multiplies monthly fee by unpaid months (e.g., ₹200/month × 3 months = ₹600 total dues).
- **Custom Amount Entry & Partial Fee Deduction**:
  - Enter any custom amount paid by a student (e.g., ₹350 towards ₹600).
  - Automatically deducts from total dues, tracks remaining balance, and marks status as `Partially Paid` or `All Dues Cleared`.
  - 1-click quick chips to autofill 1 month or full remaining dues.
- **Instant Printable Receipts**:
  - Clean printable fee slips with receipt numbers, breakdown of amount paid today, remaining balance, and official acknowledgment stamp.
- **Dashboard Overview**:
  - Real-time counters for Total Enrolled, Fees Collected, Total Outstanding Dues, and 3+ Months Overdue alert.
  - Filter tabs to isolate overdue accounts, pending dues, or cleared students.
- **Progressive Web App (PWA) & Device Installation**:
  - Installable directly to phone home screen (Android & iOS) or desktop (Windows & Mac).
  - Prominent welcome install banner when visiting the website.
  - Dedicated "Install App" button in the header.
  - Offline capability with Service Worker caching.
- **Persistent Storage**:
  - All students, payment histories, and currency settings (`₹`, `$`, `€`, `£`) persist in `localStorage`.

## Tech Stack

- **React 19**
- **Vite**
- **Lucide Icons**
- **Vanilla CSS (Custom Design System)**

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```
