"use client"

import React from 'react'

export function PrescriptionPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        /* Hide non-printable elements */
        button,
        .no-print,
        input[type="file"],
        .tabs-list {
          display: none !important;
        }

        /* Reset page margins */
        @page {
          margin: 0.5in;
          size: letter;
        }

        /* Ensure content fits on page */
        body {
          font-size: 12pt;
          line-height: 1.5;
        }

        /* Make cards print nicely */
        .card {
          break-inside: avoid;
          page-break-inside: avoid;
          border: 1px solid #e5e7eb;
          margin-bottom: 1rem;
        }

        /* Table styles for print */
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }

        th, td {
          border: 1px solid #d1d5db;
          padding: 4px 8px;
        }

        /* Meal colors in print */
        .bg-yellow-50 { background-color: #fef3c7 !important; }
        .bg-green-50 { background-color: #d1fae5 !important; }
        .bg-blue-50 { background-color: #dbeafe !important; }

        /* Ensure images print */
        img {
          max-width: 100%;
          height: auto;
          break-inside: avoid;
        }

        /* Medical photos grid for print */
        .medical-photos-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        /* Hide interactive elements */
        [contenteditable] {
          border: none !important;
          background: transparent !important;
        }

        /* Print header styles */
        .prescription-header {
          text-align: center;
          margin-bottom: 2rem;
          border-bottom: 2px solid #000;
          padding-bottom: 1rem;
        }

        .prescription-header h1 {
          font-size: 24pt;
          margin-bottom: 0.5rem;
        }

        .prescription-header .practitioner-info {
          font-size: 14pt;
          color: #4b5563;
        }

        /* Ensure all tab content is visible */
        .tabs-content {
          display: block !important;
          opacity: 1 !important;
        }

        /* Page breaks */
        .page-break {
          page-break-after: always;
        }

        .avoid-break {
          page-break-inside: avoid;
        }
      }
    `}</style>
  )
}