// Initial sales operations policy. Durations explicitly specify minutes, hours or days.
// The calendar applies to business deadlines. Lark delivery follows its own scheduling rules.
// Automatic assignment starts disabled. An empty salesIds list assigns no participants.
// Existing saved policies take precedence over these defaults.

export default {
  // No existing customer is assigned by this default. Assignment still requires saved settings.
  "autoAssignment": {
    "enabled": false,
    "strategy": "round_robin",
    "salesIds": []
  },
  // Restrict identity review and source-attribution corrections to CRM managers.
  "identityReviewManagerOnly": true,
  // False retains existing permission checks; it does not grant assignment to every employee.
  "ownerAssignmentManagerOnly": false,
  "sourceAttributionManagerOnly": true,
  "version": "2.0",
  // Operations timezone and weekly work calendar. Days use Sunday = 0 through Saturday = 6.
  "businessHours": {
    "timezone": "Asia/Jakarta",
    "startTime": "09:00",
    "endTime": "20:00",
    "workDays": [
      1,
      2,
      3,
      4,
      5,
      6
    ],
    "nextDayGraceTime": "10:00"
  },
  // First-contact deadlines for hot, warm and cold customers.
  "firstResponseSla": {
    "hot": {
      "value": 3,
      "unit": "hours"
    },
    "warm": {
      "value": 24,
      "unit": "hours"
    },
    "cold": {
      "value": 48,
      "unit": "hours"
    }
  },
  // Retry interval and attempt threshold before nurture.
  "noResponseCadence": {
    "retryInterval": {
      "value": 4,
      "unit": "hours"
    },
    "maxRetriesBeforeNurture": 3
  },
  // Elapsed inactivity before follow-up is due.
  "inactivityWatchdog": {
    "hotInactivity": {
      "value": 24,
      "unit": "hours"
    },
    "warmInactivity": {
      "value": 48,
      "unit": "hours"
    },
    "coldInactivity": {
      "value": 7,
      "unit": "days"
    }
  },
  // Reminder and follow-up offsets around trial and assessment milestones.
  "milestones": {
    "trialReminderBefore": {
      "value": 4,
      "unit": "hours"
    },
    "trialFollowUpAfter": {
      "value": 4,
      "unit": "hours"
    },
    "assessmentFollowUpAfter": {
      "value": 2,
      "unit": "hours"
    }
  },
  // Required response interval after a consultation is reopened.
  "reactivation": {
    "reactivatedResponse": {
      "value": 30,
      "unit": "minutes"
    }
  }
};
