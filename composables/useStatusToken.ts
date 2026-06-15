export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export interface StatusToken {
  tone: StatusTone
  color: string
  icon: string
}

const TONE_TO_COLOR: Record<StatusTone, string> = {
  success: 'status-success',
  warning: 'status-warning',
  error: 'status-error',
  info: 'info',
  neutral: 'status-neutral'
}

const STATUS_MAP: Record<string, { tone: StatusTone; icon: string }> = {
  // TestRequest
  REQUESTED: { tone: 'info', icon: 'mdi-send-clock-outline' },
  SCOPING: { tone: 'info', icon: 'mdi-magnify-scan' },
  SPECIALIST_ASSIGNED: { tone: 'info', icon: 'mdi-account-check-outline' },
  CONFIRMED: { tone: 'success', icon: 'mdi-handshake-outline' },
  IN_PROGRESS: { tone: 'warning', icon: 'mdi-progress-clock' },
  BLOCKED: { tone: 'error', icon: 'mdi-alert-octagon-outline' },
  COMPLETED: { tone: 'success', icon: 'mdi-check-circle-outline' },
  CANCELLED: { tone: 'neutral', icon: 'mdi-close-circle-outline' },

  // Quote
  DRAFT: { tone: 'neutral', icon: 'mdi-file-edit-outline' },
  SUBMITTED: { tone: 'info', icon: 'mdi-send-outline' },
  APPROVED: { tone: 'success', icon: 'mdi-check-decagram-outline' },
  REJECTED: { tone: 'error', icon: 'mdi-close-octagon-outline' },
  SUPERSEDED: { tone: 'neutral', icon: 'mdi-file-replace-outline' },

  // Fix
  OPEN: { tone: 'error', icon: 'mdi-bug-outline' },
  IN_REVIEW: { tone: 'warning', icon: 'mdi-eye-check-outline' },
  RESOLVED: { tone: 'success', icon: 'mdi-bug-check-outline' },
  WONT_FIX: { tone: 'neutral', icon: 'mdi-cancel' },

  // TestCard
  BACKLOG: { tone: 'neutral', icon: 'mdi-tray-full' },
  ON_HOLD: { tone: 'warning', icon: 'mdi-pause-circle-outline' },
  DONE: { tone: 'success', icon: 'mdi-check-bold' },

  // Submission
  PENDING: { tone: 'info', icon: 'mdi-email-receive-outline' },
  AWAITING_CLARIFICATION: { tone: 'warning', icon: 'mdi-help-circle-outline' },
  BUDGETED: { tone: 'info', icon: 'mdi-calculator-variant-outline' },
  ACCEPTED: { tone: 'success', icon: 'mdi-check-decagram-outline' }
}

export function useStatusToken() {
  function get(status: string | null | undefined): StatusToken {
    const key = (status || '').toUpperCase()
    const hit = STATUS_MAP[key]
    if (!hit) return { tone: 'neutral', color: TONE_TO_COLOR.neutral, icon: 'mdi-circle-outline' }
    return { ...hit, color: TONE_TO_COLOR[hit.tone] }
  }
  return { get }
}
