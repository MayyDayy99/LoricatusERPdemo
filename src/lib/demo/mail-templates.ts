// AUTOGEN a valódi app mail template-registry-jéből (25 sablon meta).
// A demóban a tárgy/HTML-törzs generált (a valódi renderelő motor nem került
// portolásra), de a sablonlista, kategóriák és változók autentikusak.
import type { MailTemplateListItem, MailTemplateDetail, TemplateCategory, TemplateVariable } from '@/lib/hooks/use-mail-templates';

interface Meta { eventKey: string; label: string; description: string; category: TemplateCategory; variables: TemplateVariable[]; }

export const MAIL_TEMPLATE_METAS: Meta[] = [
  {
    "eventKey": "quote",
    "label": "Ajánlat elküldve",
    "description": "Amikor új ajánlat készül és el kell küldeni a megrendelőnek.",
    "category": "sales",
    "variables": [
      {
        "key": "quoteNumber",
        "label": "Ajánlat száma",
        "sample": "Q-2026-0042"
      },
      {
        "key": "totalAmount",
        "label": "Végösszeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "validUntil",
        "label": "Érvényes eddig (ISO dátum)",
        "sample": "2026-09-01"
      }
    ]
  },
  {
    "eventKey": "quote.accepted",
    "label": "Ajánlat elfogadva",
    "description": "Belső értesítés a csapatnak: az ügyfél elfogadta az ajánlatot.",
    "category": "sales",
    "variables": [
      {
        "key": "quoteNumber",
        "label": "Ajánlat száma",
        "sample": "Q-2026-0042"
      },
      {
        "key": "title",
        "label": "Ajánlat címe",
        "sample": "Új épület felmérése"
      },
      {
        "key": "totalAmount",
        "label": "Végösszeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      }
    ]
  },
  {
    "eventKey": "quote.expired",
    "label": "Ajánlat lejárt",
    "description": "Az ajánlat érvényessége lejárt figyelmeztetés.",
    "category": "sales",
    "variables": [
      {
        "key": "quoteNumber",
        "label": "Ajánlat száma",
        "sample": "Q-2026-0042"
      },
      {
        "key": "totalAmount",
        "label": "Végösszeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "validUntil",
        "label": "Lejárt dátum",
        "sample": "2026-07-15"
      }
    ]
  },
  {
    "eventKey": "quote.expiry_reminder",
    "label": "Ajánlat közeledő lejárat",
    "description": "Emlékeztető: az ajánlat pár napon belül lejár.",
    "category": "sales",
    "variables": [
      {
        "key": "quoteNumber",
        "label": "Ajánlat száma",
        "sample": "Q-2026-0042"
      },
      {
        "key": "totalAmount",
        "label": "Végösszeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "validUntil",
        "label": "Érvényes eddig",
        "sample": "2026-07-15"
      },
      {
        "key": "daysRemaining",
        "label": "Hátralévő napok",
        "sample": 3
      }
    ]
  },
  {
    "eventKey": "invoice",
    "label": "Számla elküldve",
    "description": "Amikor új számla kerül az ügyfélhez.",
    "category": "sales",
    "variables": [
      {
        "key": "invoiceNumber",
        "label": "Számla száma",
        "sample": "INV-2026-0100"
      },
      {
        "key": "totalAmount",
        "label": "Összeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "dueDate",
        "label": "Fizetési határidő",
        "sample": "2026-08-15"
      }
    ]
  },
  {
    "eventKey": "invoice.overdue",
    "label": "Lejárt számla",
    "description": "A fizetési határidő elmúlt, kérjük szíveskedjenek rendezni.",
    "category": "sales",
    "variables": [
      {
        "key": "invoiceNumber",
        "label": "Számla",
        "sample": "INV-2026-0100"
      },
      {
        "key": "totalAmount",
        "label": "Összeg",
        "sample": 350000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "dueDate",
        "label": "Volt esedékes",
        "sample": "2026-07-15"
      }
    ]
  },
  {
    "eventKey": "deal.won",
    "label": "Deal megnyerve",
    "description": "Belső csapat-értesítés: sikeresen lezárult egy deal.",
    "category": "sales",
    "variables": [
      {
        "key": "dealTitle",
        "label": "Deal címe",
        "sample": "Nagy villa terve"
      },
      {
        "key": "dealId",
        "label": "Deal ID",
        "sample": "d-a3f2-..."
      }
    ]
  },
  {
    "eventKey": "deal.lost",
    "label": "Deal elveszett",
    "description": "A deal nem sikerült — csapat-értesítés.",
    "category": "sales",
    "variables": [
      {
        "key": "dealTitle",
        "label": "Deal címe",
        "sample": "Nagy villa terve"
      },
      {
        "key": "dealId",
        "label": "Deal ID",
        "sample": "d-a3f2-..."
      }
    ]
  },
  {
    "eventKey": "contract.activated",
    "label": "Szerződés aktiválva",
    "description": "A szerződés kezdő dátuma elért, aktívvá vált.",
    "category": "sales",
    "variables": [
      {
        "key": "contractNumber",
        "label": "Szerződés száma",
        "sample": "C-2026-0005"
      },
      {
        "key": "title",
        "label": "Cím",
        "sample": "Építési szerződés — Kossuth u."
      },
      {
        "key": "value",
        "label": "Érték",
        "sample": 3500000
      },
      {
        "key": "currency",
        "label": "Pénznem",
        "sample": "HUF"
      },
      {
        "key": "startDate",
        "label": "Kezdet",
        "sample": "2026-08-01"
      },
      {
        "key": "endDate",
        "label": "Vége",
        "sample": "2026-12-31"
      }
    ]
  },
  {
    "eventKey": "contract.expiring_soon",
    "label": "Szerződés közeledő lejárat",
    "description": "Emlékeztető: hamarosan lejár egy szerződés.",
    "category": "sales",
    "variables": [
      {
        "key": "contractNumber",
        "label": "Szerződés",
        "sample": "C-2026-0005"
      },
      {
        "key": "title",
        "label": "Cím",
        "sample": "Építési szerződés"
      },
      {
        "key": "endDate",
        "label": "Vége",
        "sample": "2026-12-31"
      },
      {
        "key": "daysRemaining",
        "label": "Hátralévő napok",
        "sample": 14
      }
    ]
  },
  {
    "eventKey": "contract.expired",
    "label": "Szerződés lejárt",
    "description": "A szerződés lejárt.",
    "category": "sales",
    "variables": [
      {
        "key": "contractNumber",
        "label": "Szerződés",
        "sample": "C-2026-0005"
      },
      {
        "key": "title",
        "label": "Cím",
        "sample": "Építési szerződés"
      },
      {
        "key": "endDate",
        "label": "Vége",
        "sample": "2026-07-15"
      }
    ]
  },
  {
    "eventKey": "work_order.completed",
    "label": "Munkalap befejezve",
    "description": "A munkalap elkészült — értesítés a megrendelőnek.",
    "category": "operations",
    "variables": [
      {
        "key": "workOrderNumber",
        "label": "Munkalap",
        "sample": "WO-2026-0042"
      },
      {
        "key": "location",
        "label": "Helyszín",
        "sample": "Budapest, Kossuth u. 12."
      }
    ]
  },
  {
    "eventKey": "work_order.signed_off",
    "label": "Munkalap aláírva",
    "description": "A megrendelő aláírta a munkalapot.",
    "category": "operations",
    "variables": [
      {
        "key": "workOrderNumber",
        "label": "Munkalap",
        "sample": "WO-2026-0042"
      },
      {
        "key": "signerName",
        "label": "Aláíró",
        "sample": "Kovács János"
      },
      {
        "key": "signedAt",
        "label": "Időpont",
        "sample": "2026-07-22 14:30"
      }
    ]
  },
  {
    "eventKey": "work_order.deadline_approaching",
    "label": "Munkalap közeledő határidő",
    "description": "Emlékeztető: hamarosan lejár egy munkalap határideje.",
    "category": "operations",
    "variables": [
      {
        "key": "workOrderNumber",
        "label": "Munkalap",
        "sample": "WO-2026-0042"
      },
      {
        "key": "location",
        "label": "Helyszín",
        "sample": "Kossuth u."
      },
      {
        "key": "deadline",
        "label": "Határidő",
        "sample": "2026-08-01"
      },
      {
        "key": "daysRemaining",
        "label": "Hátralévő napok",
        "sample": 3
      }
    ]
  },
  {
    "eventKey": "meeting.closed",
    "label": "Reggeli standup zárva",
    "description": "A napi standup lezárult — csapat-összesítő.",
    "category": "operations",
    "variables": [
      {
        "key": "date",
        "label": "Nap",
        "sample": "2026-07-23"
      },
      {
        "key": "tasksCount",
        "label": "Kiosztott feladatok",
        "sample": 12
      }
    ]
  },
  {
    "eventKey": "crm_task.assigned",
    "label": "CRM-feladat kiosztva",
    "description": "Új CRM-feladatot kaptál — értesítés az assignee-nek.",
    "category": "operations",
    "variables": [
      {
        "key": "taskTitle",
        "label": "Feladat címe",
        "sample": "Ügyfél visszahívása"
      },
      {
        "key": "taskId",
        "label": "Feladat ID",
        "sample": "t-abcd-..."
      }
    ]
  },
  {
    "eventKey": "drone.expiry_digest",
    "label": "Drón lejárati emlékeztető",
    "description": "Napi/heti digest az eszközök és pilóták közelgő lejáratairól.",
    "category": "drone",
    "variables": [
      {
        "key": "tenantName",
        "label": "Tenant",
        "sample": "Loricatus"
      },
      {
        "key": "daysWindow",
        "label": "Ablak (napok)",
        "sample": 30
      }
    ]
  },
  {
    "eventKey": "drone_form.invite",
    "label": "Drón űrlap meghívó",
    "description": "A megrendelőnek egy drón-repülési űrlap kitöltési link.",
    "category": "drone",
    "variables": [
      {
        "key": "name",
        "label": "Név",
        "sample": "Kovács Máté"
      },
      {
        "key": "link",
        "label": "Űrlap-link",
        "sample": "https://crm.bimgeneral.hu/public/drone-form/abc123"
      },
      {
        "key": "operationLocation",
        "label": "Helyszín",
        "sample": "Budapest"
      },
      {
        "key": "deadline",
        "label": "Határidő",
        "sample": "2026-08-15"
      }
    ]
  },
  {
    "eventKey": "drone_form.submitted",
    "label": "Drón űrlap kitöltve",
    "description": "Az admin kapja: a megrendelő beküldte a drón-űrlapot.",
    "category": "drone",
    "variables": [
      {
        "key": "name",
        "label": "Admin-név",
        "sample": "Nemes Péter"
      },
      {
        "key": "recipientName",
        "label": "Kitöltő megrendelő",
        "sample": "Kovács Máté"
      },
      {
        "key": "operationLocation",
        "label": "Helyszín",
        "sample": "Budapest"
      },
      {
        "key": "submittedAt",
        "label": "Beküldve",
        "sample": "2026-07-22 10:15"
      },
      {
        "key": "formViewUrl",
        "label": "Űrlap-URL",
        "sample": "https://crm.bimgeneral.hu/drone/forms/xyz"
      }
    ]
  },
  {
    "eventKey": "referral.invite",
    "label": "Meghívó — új ügyfél",
    "description": "Egy dolgozó ajánlása egy potenciális ügyfélnek regisztrációra.",
    "category": "lifecycle",
    "variables": [
      {
        "key": "recipientName",
        "label": "Meghívott neve",
        "sample": "Nagy László"
      },
      {
        "key": "referrerName",
        "label": "Ajánló neve",
        "sample": "Kovács Máté"
      },
      {
        "key": "inviteUrl",
        "label": "Meghívó-link",
        "sample": "https://crm.bimgeneral.hu/public/referral/abc123"
      },
      {
        "key": "expiresAt",
        "label": "Érvényes eddig",
        "sample": "2026-08-22"
      }
    ]
  },
  {
    "eventKey": "lifecycle.welcome",
    "label": "Üdvözlő email",
    "description": "Új user regisztráció után egy héttel jön.",
    "category": "lifecycle",
    "variables": [
      {
        "key": "firstName",
        "label": "Keresztnév",
        "sample": "Máté"
      },
      {
        "key": "lastName",
        "label": "Vezetéknév",
        "sample": "Kovács"
      }
    ]
  },
  {
    "eventKey": "customer.check_in",
    "label": "Ügyfél check-in",
    "description": "30+ napja inaktív ügyfélnek reengagement email.",
    "category": "lifecycle",
    "variables": [
      {
        "key": "firstName",
        "label": "Keresztnév",
        "sample": "Máté"
      },
      {
        "key": "lastName",
        "label": "Vezetéknév",
        "sample": "Kovács"
      }
    ]
  },
  {
    "eventKey": "birthday",
    "label": "Születésnapi köszöntő",
    "description": "Automata email a felhasználó születésnapján.",
    "category": "lifecycle",
    "variables": [
      {
        "key": "firstName",
        "label": "Keresztnév",
        "sample": "Máté"
      },
      {
        "key": "lastName",
        "label": "Vezetéknév",
        "sample": "Kovács"
      }
    ]
  },
  {
    "eventKey": "share.expiring_reminder",
    "label": "Megosztás közeledő lejárat",
    "description": "Egy public megosztási link hamarosan lejár.",
    "category": "notifications",
    "variables": [
      {
        "key": "shareToken",
        "label": "Token",
        "sample": "abcdef1234"
      },
      {
        "key": "expiresAt",
        "label": "Lejár",
        "sample": "2026-08-01"
      },
      {
        "key": "scope",
        "label": "Cél",
        "sample": "Dokumentum: Ajánlat Q-2026-0042"
      },
      {
        "key": "daysRemaining",
        "label": "Hátralévő napok",
        "sample": 3
      }
    ]
  },
  {
    "eventKey": "document.ready_for_review",
    "label": "Dokumentum kész",
    "description": "PDF-generálás befejezve, a link elérhető.",
    "category": "notifications",
    "variables": [
      {
        "key": "name",
        "label": "Címzett neve",
        "sample": "Kovács Máté"
      },
      {
        "key": "documentTitle",
        "label": "Dokumentum címe",
        "sample": "Ajánlat Q-2026-0042"
      },
      {
        "key": "documentType",
        "label": "Típus",
        "sample": "quote"
      },
      {
        "key": "downloadUrl",
        "label": "Letöltési URL",
        "sample": "https://.../download/abc"
      }
    ]
  }
];

export interface MailOverride { eventKey: string; subject: string; htmlBody: string; textBody: string | null; isActive: boolean; updatedAt: string; }

function interpolate(s: string, params: Record<string, unknown>): string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => (params[k] !== undefined ? String(params[k]) : '{{' + k + '}}'));
}

function renderDefault(m: Meta, params: Record<string, unknown>) {
  const vars = m.variables.slice(0, 5);
  const rows = vars.map((v) => `<tr><td style="padding:6px 14px;color:#6b7280;font-size:13px">${v.label}</td><td style="padding:6px 14px;font-weight:600;color:#111827">{{${v.key}}}</td></tr>`).join("");
  const subject = m.variables[0] ? `${m.label} — {{${m.variables[0].key}}}` : m.label;
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">` +
    `<div style="background:#12331f;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0"><h1 style="margin:0;font-size:20px;letter-spacing:.02em">LORICATUS</h1></div>` +
    `<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">` +
    `<h2 style="margin:0 0 8px;font-size:18px">${m.label}</h2>` +
    `<p style="color:#4b5563;line-height:1.55;margin:0 0 16px">${m.description}</p>` +
    `<table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px">${rows}</table>` +
    `<p style="margin:20px 0 0"><a href="#" style="display:inline-block;background:#c8a24a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600">Megnyitás a rendszerben</a></p>` +
    `<p style="color:#9ca3af;font-size:12px;margin-top:22px;border-top:1px solid #f3f4f6;padding-top:14px">Loricatus Group Kft. · Ez egy automatikus rendszerüzenet.</p>` +
    `</div></div>`;
  const text = `${m.label}\n\n${m.description}\n\n` + vars.map((v) => `${v.label}: {{${v.key}}}`).join("\n");
  return { subject: interpolate(subject, params), html: interpolate(html, params), text: interpolate(text, params) };
}

function sampleParams(m: Meta): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  for (const v of m.variables) p[v.key] = v.sample as unknown;
  return p;
}

export function buildMailList(overrides: MailOverride[]): MailTemplateListItem[] {
  return MAIL_TEMPLATE_METAS.map((m) => {
    const o = overrides.find((x) => x.eventKey === m.eventKey);
    return { eventKey: m.eventKey, label: m.label, description: m.description, category: m.category, hasOverride: !!o, isActive: o ? o.isActive : true, updatedAt: o ? o.updatedAt : null };
  });
}

export function buildMailDetail(eventKey: string, overrides: MailOverride[]): MailTemplateDetail | null {
  const m = MAIL_TEMPLATE_METAS.find((x) => x.eventKey === eventKey);
  if (!m) return null;
  const defaultPreview = renderDefault(m, sampleParams(m));
  const o = overrides.find((x) => x.eventKey === eventKey);
  return {
    eventKey: m.eventKey, label: m.label, description: m.description, category: m.category,
    hasOverride: !!o, isActive: o ? o.isActive : true,
    subject: o ? o.subject : defaultPreview.subject,
    htmlBody: o ? o.htmlBody : defaultPreview.html,
    textBody: o ? o.textBody : defaultPreview.text,
    variables: m.variables, defaultPreview,
  };
}
