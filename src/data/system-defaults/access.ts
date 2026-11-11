// Initial staff roster and built-in role templates. Never store passwords here.
// Role names and descriptions use [English, Indonesian, Chinese].
// Grants describe the initial customer scope. Saved employee permissions take precedence.
// Initial administrator bootstrap and credential checks remain enforced by the server.

export default {
  "roles": {
    "finance": {
      "names": [
        "Finance",
        "Keuangan",
        "财务"
      ],
      "description": [
        "View customers and verify receipts and refunds; no customer or pricing edits",
        "Lihat pelanggan dan verifikasi penerimaan serta pengembalian; tanpa mengubah data atau harga",
        "查看客户并核验收退款；不可修改客户资料、报价或优惠"
      ],
      "grants": {
        "crm.read": "all",
        "crm.payments.verify": "all"
      }
    },
    "crm_leader": {
      "names": [
        "CRM Manager",
        "Manajer CRM",
        "CRM 管理者"
      ],
      "description": [
        "Manage sales across all customers",
        "Kelola penjualan seluruh pelanggan",
        "管理全部客户的销售业务"
      ],
      "grants": {
        "crm.read": "all",
        "crm.write": "all",
        "crm.followup": "all",
        "crm.attendance": "all",
        "crm.assign": "all",
        "crm.export": "all",
        "crm.leader": "all",
        "campaigns.manage": "all",
        "crm.operations.manage": "all",
        "notifications.read": "all",
        "notifications.manage": "all"
      }
    },
    "sales": {
      "names": [
        "Sales",
        "Staf penjualan",
        "销售"
      ],
      "description": [
        "Handle own customers and claim eligible unassigned customers",
        "Tangani pelanggan sendiri dan ambil pelanggan tanpa penanggung jawab",
        "处理本人客户并认领符合范围的未分配客户"
      ],
      "grants": {
        "crm.read": "own",
        "crm.write": "own",
        "crm.followup": "own",
        "crm.attendance": "own",
        "crm.own": "own",
        "crm.claim": "all"
      }
    },
    "cms_admin": {
      "names": [
        "CMS Operator",
        "Operator CMS",
        "CMS 操作员"
      ],
      "description": [
        "Manage website content",
        "Kelola konten situs",
        "管理网站内容"
      ],
      "grants": {
        "cms.manage": "all"
      }
    },
    "hr_reader": {
      "names": [
        "HR Recruiter",
        "Staf Rekrutmen",
        "HR招聘专员"
      ],
      "description": [
        "Read recruitment submissions only",
        "Hanya melihat lamaran kerja",
        "仅查看招聘申请"
      ],
      "grants": {
        "applications.read": "all"
      }
    },
    "access_admin": {
      "names": [
        "System Administrator",
        "Administrator Sistem",
        "系统管理员"
      ],
      "description": [
        "Manage staff access; business data requires separate roles",
        "Kelola akses staf; data bisnis memerlukan peran lain",
        "管理员工权限；业务数据须另行授予角色"
      ],
      "grants": {
        "access.read": "all",
        "access.users": "all",
        "access.roles": "all",
        "access.sessions": "all",
        "access.audit": "all"
      }
    }
  },
  "accounts": [
    [
      "Suki",
      [
        "crm_leader",
        "finance"
      ]
    ],
    [
      "Robert",
      [
        "crm_leader",
        "cms_admin",
        "finance"
      ]
    ],
    [
      "Fadhil",
      [
        "sales"
      ]
    ],
    [
      "Zainul",
      [
        "sales"
      ]
    ],
    [
      "Wigar",
      [
        "sales"
      ]
    ],
    [
      "Tester",
      [
        "crm_leader",
        "sales"
      ]
    ],
    [
      "Fenny",
      [
        "cms_admin"
      ]
    ],
    [
      "Ethan",
      [
        "crm_leader",
        "cms_admin"
      ]
    ],
    [
      "Monite",
      [
        "crm_leader",
        "cms_admin"
      ]
    ]
  ]
};
