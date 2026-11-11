// Initial notification channels, policies and employee preferences.
// New group and personal channels use live delivery. Existing saved modes take precedence.
// Rule entries override ruleDefaults. Operational calendar values come from sales.ts.
// Delivery mode does not bypass credentials, employee binding, permissions or recipient checks.

export default {
  // Initial group channel settings. The actual Webhook is supplied privately.
  "groupChannel": {
    "groupName": "Lark 群通知",
    "systemManaged": true,
    "mode": "live",
    "signingEnabled": false
  },
  // Initial personal channel state. Revision 1 prevents legacy mode migration on a new installation.
  "personalChannel": {
    "mode": "live",
    "revision": 1
  },
  // Default card language unless the saved policy or employee preference overrides it.
  "language": "en",
  // Default delivery limit per hour. Explicit channel limits take precedence.
  "maxPerHour": 100,
  // Shared policy values. Delays, retry intervals and deduplication are expressed in minutes.
  "ruleDefaults": {
    "calendarMode": "inherit",
    "event": "lead.created",
    "channels": [
      "inapp",
      "lark"
    ],
    "recipient": "owner",
    "group": "sales",
    "sources": [],
    "tiers": [],
    "states": [],
    "timing": "immediate",
    "delayMinutes": 0,
    "digestTime": "18:00",
    "businessOnly": true,
    "dedupeMinutes": 15,
    "retries": [
      1,
      5,
      15
    ],
    "template": "{{event}} · {{name}} · {{owner}} · {{due}}"
  },
  // Event-specific overrides. Retired event types are intentionally absent.
  "rules": [
    {
      "event": "commitment.due",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ],
      "group": "lark-group-default"
    },
    {
      "event": "conversation.updated",
      "channels": [
        "inapp"
      ]
    },
    {
      "event": "lead.created",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "lead.assigned",
      "channels": [
        "inapp",
        "lark_personal"
      ],
      "group": "",
      "dedupeMinutes": 0
    },
    {
      "event": "conversation.reactivated",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "handoff.requested",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "booking.requested",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "enrollment.requested",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "assessment.completed",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ],
      "timing": "digest"
    },
    {
      "event": "task.overdue",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ]
    },
    {
      "event": "ai.failed",
      "channels": [
        "inapp",
        "lark_group",
        "lark_personal"
      ],
      "recipient": "managers",
      "group": "ops"
    },
    {
      "event": "notification.failed",
      "channels": [
        "inapp",
        "lark_group"
      ],
      "recipient": "managers",
      "group": "ops"
    },
    {
      "event": "daily.digest",
      "channels": [
        "inapp",
        "lark_group"
      ],
      "recipient": "managers",
      "group": "lark-group-default",
      "timing": "digest"
    }
  ],
  // New employees follow the policy language and disable no optional events.
  "personalPreferences": {
    "revision": 0,
    "language": "rule",
    "disabledTypes": []
  },
  // Business reminders that employees cannot turn off.
  "requiredPersonalTypes": [
    "handoff.requested",
    "booking.requested",
    "enrollment.requested",
    "commitment.due",
    "task.overdue"
  ],
  // Operational failures follow role visibility and remain mandatory when applicable.
  "operationsPersonalTypes": [
    "ai.failed",
    "notification.failed"
  ]
};
