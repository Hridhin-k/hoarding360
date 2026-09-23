# Manage CRM — manual test guide

The CRM is the `/manage` portal (media-owner OS). This guide lists every screen, control, and rule currently in the app. Tick a box only after you have seen the expected result.

Run the whole script once as **company admin**, then repeat the role section with the other accounts.

Use a throwaway board code such as `QA-001`, one client, and dates you can recognise.

Formats to confirm everywhere:

- Money is ₹ with Indian grouping (a ₹60,000 card rate must not display as 6000000 or as paise).
- Business dates are `DD-MM-YYYY`.
- Timestamps (alerts, proofs, incidents, activity) are Asia/Kolkata (IST).
- Lifecycle, compliance, and occupancy stay as three separate badges. They never collapse into one status word.



## Not built yet

Do not file these as bugs:

- Board 360 tabs **History**, **Costs**, and **Profitability** are placeholders (“coming soon”). Costs and Profitability appear only for company admin, operations manager, and finance officer.
- Email and SMS stay queued while **dry-run** is on. The UI says delivery waits until a provider is configured.
- Gallery supports upload only. There is no delete-photo or set-cover control.
- Proof pack PDF and the shareable proof link need at least one Field proof first.



## Roles and navigation

Sign out, then open `/manage`. You should land on `/auth/login?next=/manage`.

Nav hides items. It never shows a disabled link. For each role, confirm every item in the “sees” column is present and every item in the “absent” column is missing.

Also type a forbidden URL directly. Record whether the page still loads and whether Save is rejected. Sidebar hiding and the server check are separate tests.


| Role               | Sees                                                                                                                         | Absent from nav                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Company admin      | All groups below, plus company profile, team, and ops settings                                                               | —                                                                                                                                        |
| Operations manager | Same nav as admin                                                                                                            | Company profile, team, ops windows, and the permission matrix. Settings shows messaging plus a note that company and team are admin-only |
| Sales executive    | Dashboard, clients, agreements, new agreement, availability, vacancies, boards, map, alerts, vacancy pipeline, heat calendar | Floor rate, printing, mounting, costs, import, incidents, compliance, doc vault, activity, reports, proof review, settings               |
| Finance officer    | Dashboard, clients, vacancies, boards, alerts, vacancy pipeline, exports. Floor rates are visible                            | Agreements nav, map, import, incidents, compliance, settings, proof review, calendar                                                     |
| Compliance officer | Dashboard, boards, map, incidents, risk and renewals, doc vault, alerts, activity log                                        | Clients, agreements, availability, vacancies, import, calendar, reports, proof review, settings                                          |
| Field supervisor   | Dashboard, boards, map, availability, incidents, alerts, proof review, and the Field link in the sidebar footer              | Clients, agreements, vacancies, import, compliance, calendar, reports, settings. Map is limited to their city/district scope             |
| Field technician   | Redirected from `/manage` to `/field`                                                                                        | The entire CRM                                                                                                                           |


Sales must never see floor rate, printing charge, or mounting charge. Finance, admin, and ops must see them. Client names and those internal rates must never appear on the public marketplace (`/boards`).

Sidebar footer:

- **Marketplace** opens `/boards` for every CRM role.
- **Field PWA** shows for company admin, operations manager, and field roles. It is absent for sales, finance, and compliance.

---



## 1. Shell

- [x] Logged-out visit to `/manage` redirects to `/auth/login?next=/manage`.
- [ ] Company admin sees sidebar groups Home, Sales, Ops, Compliance, Reports, Admin.
- [ ] Header shows search, ⌘K, Alerts, and Sign out.
- [ ] Field technician login is sent from `/manage` to `/field` and never sees the CRM shell.
- [ ] Global search with 1 character shows nothing.
- [ ] Global search with 2+ characters searches board code, board name, client name, and agreement ref.
- [ ] A hit shows kind plus subtitle (city, GST, or client and status). Click opens the record and clears the box.
- [ ] No matches shows “No matches”. Clicking outside closes the list.
- [ ] ⌘K / Ctrl+K opens Quick add. Esc and the backdrop close it.
- [ ] Quick add filters by label or shortcut letter: b board, c client, a agreement, i import, v availability, p compliance, n incidents, l activity, r reports, s settings, h calendar, g proof review. Each jump lands on the right page.
- [ ] The ⌘K button is hidden on a narrow phone. The keyboard shortcut still toggles the dialog.
- [ ] Alerts shows the unread count, or `99+` above 99, and opens `/manage/notifications`. Zero unread has no badge.
- [ ] Sign out returns to login. Going back to `/manage` asks for login again.
- [ ] For each role, nav matches the table above.
- [ ] Direct-URL check for a role that should not see Import, Settings, Activity, Reports, Compliance, Incidents, or Proof review. Record whether the URL loads and whether the write is rejected.



## 2. Dashboard

Heading by role:

- Company admin and operations manager: **Owner OS**
- Sales executive: **Sales desk**
- Compliance officer: **Compliance risk**
- Finance officer: **Revenue & collections**
- Field supervisor: **Field ops**

The line under the heading shows the company name and the role.

- [ ] Structures count equals non-deleted boards.
- [ ] Admin, ops, sales, and finance see Live revenue in ₹ and a live-agreement count. Sales adds “card rates only”.
- [ ] Field supervisor sees **Open Field PWA** in that slot instead of revenue.
- [ ] Risk strip is expired + expiring + missing mandatory clearances and links to `/manage/compliance`.
- [ ] Sales sees **New agreement** in the risk slot instead.
- [ ] Unread alerts matches the header bell and links to `/manage/notifications`.
- [ ] Occupancy % is sold faces (occupied, booked future, on hold) divided by all faces. Sold and free counts match.
- [ ] No photo and No card rate match boards missing a gallery or a face card rate. Both open the boards list.
- [ ] Audit opens Activity.
- [ ] Vacancy loss equals days empty × card rate / 30 and opens Availability.
- [ ] Ending in 90 days counts active agreements in that window and opens Agreements.
- [ ] Find free faces opens Availability.
- [ ] Worst vacant faces, when any exist, link to that board’s Occupancy tab and show loss in ₹.
- [ ] Revenue by client appears only for admin, ops, and finance. Each name opens the client and shows agreement count and value. Hidden for sales.
- [ ] Open Field button appears for admin, ops, and field supervisor. Hidden for sales, finance, and compliance.
- [ ] Needs attention lists unread alerts (10 for compliance, 5 otherwise) and **All alerts** works. Hidden when there are none.
- [ ] Live campaigns lists up to 8 active in-range agreements: client, ref, face count, IST dates, value. Empty state when none. Client name opens the client. **New agreement** works. Hidden for compliance and field.
- [ ] Onboarding tracker (admin and ops only) shows GPS, Photo, Rate, Permit, and Agreement percentages. **Bulk import CSV** opens Import.
- [ ] Upcoming vacancies (hidden for compliance and field) shows the card-rate pipeline total. Sales sees 10 rows, other roles 5. Each row: code, face, occupancy, available-from (`DD-MM-YYYY`), city, card rate. **All vacancies** works. Empty copy when none.



## 3. Boards list and map

`/manage/boards`

- [ ] Columns: code, name, city, structure, and three separate badges (lifecycle, compliance, occupancy).
- [ ] Subtitle count matches the filtered rows. The list is the 300 newest boards.
- [ ] Search matches code or name, ignoring case.
- [ ] City dropdown lists only cities that exist on boards.
- [ ] Lifecycle filter: draft, pending verification, active, under maintenance, blocked, non compliant, retired.
- [ ] Compliance filter: valid, expiring soon, expired, missing, under renewal.
- [ ] Occupancy filter uses the worst face: vacant, becoming vacant, occupied, booked future, blocked, on hold.
- [ ] Combined filters work. **Clear** resets all of them.
- [ ] A filter with no rows offers Import CSV and clear filters. A query error shows in red.
- [ ] Code and name open Board 360. **Map** and **Add board** work.

`/manage/boards/map`

- [ ] Only boards with latitude and longitude, up to 500. Empty state if none.
- [ ] Pin colours: active green, draft grey, maintenance yellow, retired red. Zoom control works.
- [ ] Clicking a pin shows code, name, occupancy, and a link to the board.
- [ ] A field supervisor with a city or district scope sees only those pins, and the page says the map is filtered to that scope.



## 4. Create and edit a board

`/manage/boards/new`

Identity:

- [ ] Board code and name are required. Saving without them shows an error.
- [ ] Structure types: hoarding, unipole, gantry, bridge panel, pole kiosk, led screen, other.
- [ ] Ownership: owned, leased in, managed for third party.
- [ ] Installed on, ward / zone, meter number, and Street View URL save.
- [ ] Lifecycle defaults to draft.

GPS and address:

- [ ] Paste `12.9716, 77.5946` and **Apply**. Latitude and longitude fill in.
- [ ] Paste a Google Maps link that contains `@lat,lng` and Apply again.
- [ ] A nonsense string shows “Could not parse coordinates”.
- [ ] Typing latitude and longitude by hand also saves.
- [ ] Address, landmark, road, city, district, state, PIN, and how to reach save.

Faces:

- [ ] The form starts with face A, 40×20 ft, frontlit, card rate 60000.
- [ ] Illumination: frontlit, backlit, nonlit, led. Facing is free text.
- [ ] **+ Add face** uses the next letter. **Remove face** is hidden while only one face remains.
- [ ] Admin, ops, and finance see floor rate, printing, and mounting.
- [ ] Sales does not see those three fields on create or edit, and Board 360 rate history says “card rates only”.
- [ ] **Create board** opens that board. Activity shows board created and face added.
- [ ] A duplicate board code is rejected and the error stays on the form.
- [ ] The button reads Saving… while the request is in flight.

Edit (`Edit board` on Board 360):

- [ ] Board code is disabled.
- [ ] Changing name, a rate, and GPS updates Board 360 after save.
- [ ] Saving faces soft-removes the old faces with reason “replaced on edit” and inserts new ones. The live face list shows only the new faces.
- [ ] Lifecycle **retired** with an empty reason is blocked (“Retiring a board requires a reason”).
- [ ] Retire with a reason keeps the board in the list as retired. Activity records board retired plus that reason. There is no Delete board anywhere. Retired faces drop out of Availability.



## 5. Board 360

Open `/manage/boards/{id}`.

- [ ] Back link returns to Boards. Header shows code, name, city · district · state, three badges, and **Edit board**.
- [ ] An unknown id is a not-found page. The default tab is Overview. `?tab=` selects a tab.
- [ ] Tabs: Overview, Gallery, Occupancy, Rate history, Compliance, Agreements, Activity, Documents, Proof, Incidents, Marketplace, History (coming soon).
- [ ] Costs and Profitability appear only for admin, ops, and finance, and they show “coming soon”.



### Overview

- [ ] Map renders when GPS exists, and a placeholder when it does not.
- [ ] Structure rows: type, ownership, installed (`DD-MM-YYYY`), address, landmark, road, ward, meter, PIN, how to reach.
- [ ] Street view is a link in a new tab, or an em dash when empty.
- [ ] QR card generates an image, shows a shortened token, the full `/field/b/{token}` URL, **Open in Field**, and **Public report link** (`/report/{token}`). Both links open.
- [ ] Faces list: label, width×height ft, square feet, illumination, facing, occupancy, available-from, card rate in ₹. Empty copy if there are no faces.



### Gallery

- [ ] Photo kind: day, night, approach, other.
- [ ] Upload jpeg, png, or webp. The first photo is marked cover.
- [ ] Caption shows kind, IST date, and cover. “Preview unavailable” if the signed URL fails.
- [ ] Empty state before any upload. Activity records photo added.



### Occupancy

- [ ] One card per face with status and available-from.
- [ ] Timeline lists periods with status, dates, client, agreement ref, and block reason.
- [ ] Empty timeline copy before any booking or block.



### Rate history

- [ ] After a rate edit, a new append-only row appears with face label, amounts, reason, and timestamp.
- [ ] Sales omits floor rate and charges. Admin, ops, and finance include them.



### Compliance

Status is calculated from expiry. You never type valid or expired.

- [ ] **Add clearance** opens the form. **Cancel** closes it.
- [ ] Presets: municipal licence, traffic police NOC, structural stability, electrical safety, landowner permission, highway permission, fire NOC. Choosing one fills the governing body.
- [ ] **Custom…** lets you type a type name.
- [ ] A clearance type added in Settings appears in this preset list.
- [ ] Required: type and governing body. Optional: reference, renewal cycle months, issue date, expiry, fee in rupees, notes, mandatory checkbox.
- [ ] Expiry far ahead = valid. Expiry within 90 days = expiring soon. Expiry in the past = expired. No dates = missing.
- [ ] The board compliance badge follows the worst mandatory record.
- [ ] Each row shows type, body, reference, dates, fee, cycle, badge, and mandatory.
- [ ] **Mark under renewal** sets that state and logs it.
- [ ] **Complete renewal** requires a new expiry. Optional: new reference, issue date, fee, notes. The old record is superseded. The new record is valid when the expiry is in the future. Activity: clearance renewed.
- [ ] **Remove** asks you to confirm, then the row disappears (soft delete). Activity: clearance removed.



### Publish override

Shown on the Compliance tab and the Marketplace tab.

- [ ] Visible only for company admin and operations manager, and only when a mandatory clearance is expired or an override is already active.
- [ ] Until date plus reason. Maximum 30 days.
- [ ] Grant, then **Revoke override**. Both are on the activity log.
- [ ] The Compliance page lists the active override (board, until date, reason) and links back to the compliance tab.
- [ ] Sales does not see the form. Compliance officer: confirm they do not see it either (the form checks admin/ops, while the permission matrix also lists an override permission for compliance officer).



### Agreements, activity, documents

- [ ] Agreements tab lists face lines with client, ref, dates, status, and rate, plus **New agreement**. Empty state when none.
- [ ] Activity tab is this board only, newest first. Empty copy before any edits.
- [ ] Documents: type, reference, issue date, expiry, PDF or image. **Open** uses a signed link. **Remove** confirms and soft-deletes.
- [ ] Uploading the same document type twice makes the new file the next version (v2) and current. The older file is no longer current.
- [ ] Document types: municipal licence, traffic NOC, structural certificate, electricity bill, lease deed, agreement / contract, tax receipt, photo proof, other.



### Proof and incidents

- [ ] Proof rows show Geo OK or Outside radius, distance in metres, IST time, and notes.
- [ ] Empty state says field technicians submit via QR scan.
- [ ] **Download proof pack PDF** appears only when proofs exist (up to 12 captures) and the file downloads.
- [ ] **Create shareable proof link** (14 days) shows `/share/proof/{token}`. That page opens without a CRM login.
- [ ] Incidents tab lists title, status, severity, category, IST time, and description. Empty state when none.



### Marketplace

- [ ] Checklist appears when lifecycle is not active, GPS is missing, or a mandatory clearance is expired. Photo is described as optional.
- [ ] When gates pass, the panel says the board looks ready.
- [ ] Org settings: marketplace enabled, public display name, default price on request, accept enquiries. **Save org settings** confirms the projection refreshed.
- [ ] **Publish face** / **Unpublish**. Success text differs when the face is actually listed versus only marked publishable.
- [ ] Public `/boards` listing has no client name, floor rate, printing, mounting, or cost.
- [ ] An expired mandatory clearance keeps the face off Market until it is renewed or an override is active.



### Placeholder tabs

- [ ] History shows coming soon.
- [ ] Costs and Profitability show coming soon for finance roles, and are absent for sales, compliance, and field supervisor.



## 6. Clients

`/manage/clients`

- [ ] Table columns: name, GSTIN, industry, sorted by name. Empty state when none.
- [ ] **Add client** and **New agreement** work. The name opens the client.

Create:

- [ ] Name is required. GSTIN, billing address, industry, and payment terms (placeholder Net 30) save.
- [ ] Contract reminders default on. Reminder email and reminder mobile save.
- [ ] An invalid mobile (not +91 / 10 digits starting 6–9) is rejected.
- [ ] `9876543210` and `+919876543210` both store as `+91` plus 10 digits.
- [ ] Primary contact on create only: name, email, mobile. Invalid contact phone is rejected.
- [ ] Create opens the client page. The contact is marked primary. Activity: client created.
- [ ] The contact fieldset is absent when editing.

Client page:

- [ ] Edit saves name, GST, address, industry, terms, and reminders. Activity: client updated.
- [ ] **New agreement** opens the form with this client selected (`?client=`).
- [ ] Agreements list shows ref, dates, status, value, and a link. Empty copy when none.
- [ ] Client document vault: upload, version, open, remove. Same document types as the board vault.
- [ ] Client name, GST, and contract value never appear on a public marketplace listing.



## 7. Agreements

`/manage/agreements`

- [ ] Search matches client name or ref.
- [ ] Status filter: draft, active, expired, terminated, cancelled.
- [ ] Ending within 30, 60, or 90 days. Terminated and cancelled drop out of that window. The subtitle shows the count and, when a window is on, value at risk for active rows only.
- [ ] **Filter** and **Clear** work. Cap is 300, sorted by end date.
- [ ] Columns: ref, client, dates (`DD-MM-YYYY`), status, value in ₹. Row opens the agreement. Empty state when none. **New agreement** works.

New agreement (`/manage/agreements/new`):

- [ ] No clients: “Create a client first”, and the button stays disabled.
- [ ] No faces: “Add a board with faces first”, and the button stays disabled.
- [ ] Client is required. Ref is optional. Start and end are required. End before start is rejected.
- [ ] **+ Add face** and **Remove line**. Choosing a face fills the rate from the card rate in rupees. A blank rate still uses the card rate.
- [ ] Face start and face end are optional and inherit the agreement dates. A face end before its face start is rejected.
- [ ] `?client=` preselects the client. `?face=` preselects the first line.
- [ ] **Create agreement** saves status **active** immediately (not draft) and opens the detail page. Value is the sum of the line rates, stored in paise and shown in ₹. Activity: agreement created.
- [ ] A second active agreement on the same face with overlapping dates fails with an overlap message. That failed attempt does not remain as a live contract.
- [ ] After a clean booking the face is occupied, or booked future if the start date is still ahead. Availability for those dates excludes the face. The occupancy timeline shows the client and ref.

Detail (`/manage/agreements/{id}`):

- [ ] Header shows client, ref or short id, status, and dates. Contract value and a client link. Back link returns to the list.
- [ ] Face lines show board code, face label, dates, rate, and “released” if the line was removed.
- [ ] Agreement document vault: upload, open, remove, versioning.

Active contract (not draft):

- [ ] **Extend / revise end date**: new end plus a reason. Overlap is checked again. Activity: agreement extended.
- [ ] **Revise as new version**: a reason. This contract terminates and you land on a draft copy with the same faces. Activity: agreement revised.
- [ ] **Terminate** with an empty reason fails. With a reason, status becomes terminated, the face is free, and the row stays in the list (never hard-deleted). Activity: agreement terminated.

Draft (from revise, or from an import with status draft):

- [ ] **Activate** shows a note (default “Activated after revision”). It re-checks overlap, moves the contract to active, and the activate form disappears. Activity: agreement activated.
- [ ] Terminate is also available on a draft.
- [ ] Terminated and cancelled contracts hide extend, revise, and activate.

Pre-listing window:

- [ ] With the org pre-listing window (Settings, default 30 days) covering an active contract’s end date, the face shows occupancy **becoming vacant** and **Available from** that end date on the board, on Vacancies, and on the dashboard, while the contract is still live.



## 8. Availability, vacancies, calendar

`/manage/availability`

- [ ] From defaults to today (IST). To defaults to today plus 30 days. City dropdown lists cities. **Search** applies them.
- [ ] Free faces are those with no occupancy period overlapping the whole range. Retired boards are excluded.
- [ ] Each row: code and face link to the Occupancy tab, board name, city, occupancy status, card rate, and **Book** (new agreement).
- [ ] Empty state when nothing is free for that range.

Manual block (bottom of Availability):

- [ ] Face, start, end, and reason. The blocked range disappears from free search.
- [ ] The occupancy timeline shows the block and the reason. The heat calendar shows it in red.
- [ ] A later agreement re-sync does not wipe the manual block.
- [ ] A block that overlaps an existing agreement is rejected. Activity: face blocked.

`/manage/vacancies`

- [ ] Chips for 30, 60, and 90 days. Default is 90. City filter keeps the selected day window.
- [ ] Subtitle shows the face count and the card-rate pipeline total.
- [ ] **Availability search** and **New agreement** work. Each row links to Occupancy. Empty state when none.
- [ ] Sidebar **Vacancy pipeline** is this same page with `?days=90`.

`/manage/calendar`

- [ ] About 26 weekly columns, from 30 days ago to 150 days ahead, up to 40 faces.
- [ ] Legend: blue occupied, yellow booked, red blocked, empty for no period.
- [ ] Face label links to the board. Empty state when there are no periods.
- [ ] On a narrow window the grid scrolls sideways and the face column stays visible. Back link returns to the dashboard.



## 9. Bulk import

`/manage/import`. Back link returns to Boards.

- [ ] Tabs: Boards, Clients, Agreements, Permits, Photos, Job history.

Boards:

- [ ] Download template CSV (`hoardings360-boards-template.csv`).
- [ ] Upload CSV, and also xlsx, xls, or ods.
- [ ] Column-mapping step suggests headers. Preview shows ok versus bad row counts.
- [ ] Apply shows boards created, faces created, and existing codes skipped.
- [ ] Bad rows can be downloaded as a correction CSV.
- [ ] Two rows with the same `board_code` and different face labels create one board and two faces.
- [ ] Importing the same code again only increases skipped. It does not duplicate the board.

Clients (template columns: name, gstin, industry, billing_address, payment_terms, contact_name, contact_email, contact_phone):

- [ ] Preview, then apply. The contact is created on the client. Record what a duplicate name does.

Agreements (template columns: client_name, board_code, face_label, starts_on, ends_on, rate_rupees, ref_code, value_rupees, status):

- [ ] An unknown client or board fails that row. An overlapping face fails that row.
- [ ] `status` draft stays draft until you activate it on the agreement page.

Permits (template columns: board_code, clearance_type, governing_body, reference_no, issue_date, expiry_date, is_mandatory):

- [ ] The row appears on that board’s Compliance tab with a computed status.

Photos:

- [ ] Multi-file upload. Name files like `QA-001_day.jpg`. The last piece must be day, night, approach, or other. A hyphen is allowed as well as an underscore.
- [ ] A bad name or an unknown board code is skipped, with a line in the log.
- [ ] A match shows OK and appears in that board’s gallery.

Job history:

- [ ] Lists kind, status, start date, finish date, and a JSON summary. Empty state before any job. Each apply writes a job. Activity: import completed.



## 10. Incidents

`/manage/incidents`

- [ ] The subtitle open-count excludes resolved and closed.
- [ ] Log incident: board, title, category, severity, description.
- [ ] Categories: damage / vandalism, illumination fault, encroachment, access blocked, creative issue, other.
- [ ] Severity: low, medium, high, critical.
- [ ] Create clears the title and description and refreshes the list. Record what an empty title does.
- [ ] Create stays disabled when there are no boards. Empty list copy when there are no incidents.
- [ ] Each row shows title, a board link to that board’s Incidents tab, category, severity, IST time, and a status menu.
- [ ] Status menu: open, acknowledged, in progress, resolved, closed. Changing it updates immediately. Activity: incident logged, then incident status updated.
- [ ] The same incident appears on the board Incidents tab with title, status, severity, category, time, and description.



## 11. Compliance risk and document vault

`/manage/compliance`

- [ ] **Risk** and **Renewal queue** toggle. Opening the page refreshes alerts.
- [ ] Stats: Expired, Expiring ≤90 days, Missing dates, Under renewal. Each stat jumps to that section.
- [ ] Only mandatory records in those four statuses are listed.
- [ ] Each row links to the board compliance tab and shows clearance type, governing body, expiry (`DD-MM-YYYY`), city, and a badge.
- [ ] Renewal queue order: under renewal, then expired, then expiring. “Queue is clear” when empty.
- [ ] Active publish overrides, when any exist, list board, until date, and reason, and link to the compliance tab.
- [ ] An expired, expiring, or missing mandatory clearance creates a notification after this refresh.

`/manage/compliance/vault`

- [ ] Search matches file name, reference number, or document type.
- [ ] Type filter: municipal licence, traffic NOC, structural, electricity, lease, agreement, other.
- [ ] **Expiring in 30 days** limits the list to documents with an expiry inside 30 days.
- [ ] Only current versions are listed. **Open** uses a signed link. Signed links are capped at 80.
- [ ] Bulk document upload: pick a board, then several PDFs or images.
- [ ] Filename classification: noc/traffic → traffic NOC; struct/stability → structural; electric/meter → electricity; lease/rent → lease; agree/contract → agreement; tax/gst/receipt → tax receipt; photo/proof → photo proof; municipal/licence/permit → municipal licence; otherwise other.
- [ ] Uploaded files appear on that board’s Documents tab as the current version.



## 12. Alerts

`/manage/notifications`

- [ ] Subtitle shows the unread count. **Refresh alerts** rebuilds permit and agreement alerts.
- [ ] **Mark all read** is disabled when unread is zero. Using it clears the header badge.
- [ ] A row shows kind, IST time, title, and body. Kinds: expired permit, expiring permit, missing permit, agreement ending.
- [ ] Unread rows have a left bar and a dot. An escalated alert shows an Escalated chip.
- [ ] Clicking the row marks it read and follows its link. **Open** does the same.
- [ ] Empty state tells you to add an expiring or expired mandatory clearance and refresh.
- [ ] Footer links to Compliance and Settings.

My alert preferences:

- [ ] In-app alerts.
- [ ] Email digest (copy says delivery waits until email is enabled org-wide and a provider is wired).
- [ ] Digest frequency: off, daily, weekly.
- [ ] Toggles: compliance / permits, agreement endings, incidents, vacancies.
- [ ] Quiet hours start and end. Save persists after reload.
- [ ] An agreement that ends inside the reminder window creates an alert when agreement reminders are enabled.
- [ ] Turning off that client’s “Enable ending reminders” — record whether the client destination stops.



## 13. Activity log and reports

`/manage/activity`

- [ ] Search matches event, reason, entity, actor name, and the stored from/to values.
- [ ] Entity type dropdown is built from the events you have. **Clear** resets search and entity.
- [ ] Subtitle count matches the filtered list (up to 500).
- [ ] Each event shows a readable label, actor, IST time, and reason when one was stored.
- [ ] **Export CSV** respects the current search and entity filter and downloads.
- [ ] Empty and error states render.

After the flows in this guide, find these labels:

- [ ] Board created, board updated, board retired, face added, photo added.
- [ ] Clearance added, clearance marked under renewal, clearance renewed, clearance removed.
- [ ] Client created, client updated.
- [ ] Agreement created, agreement extended, agreement revised, agreement activated, agreement terminated.
- [ ] Team member invited, company profile updated, face blocked.
- [ ] Incident logged, incident status updated, bulk import completed.
- [ ] Document uploaded, document removed.
- [ ] Proof pack PDF generated, proof geo review.
- [ ] Publish override granted, publish override revoked.

`/manage/reports`

- [ ] **CSV** downloads `h360-boards.csv` with board code, name, city, lifecycle, lat, and lng only.
- [ ] **Excel** has four sheets: boards, agreements (ref, client, status, dates, value in paise), vacancies, vacancy loss.
- [ ] The page links to Vacancies and the heat calendar, and lists the top vacancy-loss faces when any exist.
- [ ] The export file does not include floor rates.
- [ ] Sales, compliance officer, and field supervisor get 403 on `/manage/reports/export?format=csv` and `?format=xlsx`.
- [ ] Company admin, operations manager, and finance officer receive the file.



## 14. Proof review

`/manage/proof-review`

Needs a Field capture. Use the board QR, submit one proof within about 150 m of the board GPS and one far outside it.

- [ ] Empty state: “No pending geo-fails. Field proofs within radius auto-approve.”
- [ ] A proof inside 150 m never sits in this queue.
- [ ] A proof with geo failure and pending review shows the board link, distance in metres, IST time, a notes field, **Approve**, **Waive geo**, and **Reject**.
- [ ] Each action removes it from the queue. Notes are stored. Activity: proof geo review.
- [ ] The board Proof tab still lists that capture with Outside radius and the distance.



## 15. Settings

`/manage/settings`

- [ ] Company admin sees company profile, team, ops windows, clearance catalogue, permission matrix, and messaging.
- [ ] Operations manager sees the admin-only note plus messaging.
- [ ] Other roles: record whether the URL is reachable.

Company profile (admin):

- [ ] Display name, legal name, GSTIN, address, city, state, PIN, brand colour. Save shows success and survives reload. Activity: company profile updated.
- [ ] Brand colour is what a proof pack uses.

Team (admin):

- [ ] Invite: email, full name, and every role (company admin, operations manager, sales executive, compliance officer, finance officer, field supervisor, field technician).
- [ ] Pending invites list email, role, and status. Accepting the invite lets that user sign in with that role’s nav. Activity: team member invited.
- [ ] Changing a member’s role updates their nav on the next session.
- [ ] **Deactivate** blocks CRM access. **Reactivate** restores it. The role menu is disabled while they are deactivated.
- [ ] A field supervisor row shows cities and districts (comma-separated) and **Save scope**. After save, their portfolio map only includes those cities or districts.

Ops windows (admin):

- [ ] Pre-listing window accepts 0–90 days and changes when a face becomes “becoming vacant”.
- [ ] Escalate critical alerts after accepts 1–168 hours. Save persists after reload.
- [ ] Add a clearance type with code, label, and mandatory-by-default. It appears in the catalogue (code, mandatory, active) and in Board 360’s Add clearance presets.

Permission matrix (admin):

- [ ] Read-only, and it matches the role table at the top of this guide.
- [ ] Sales does not have floor rates. Finance has floor rates and export. Compliance officer has compliance write, override, and incident triage. Field supervisor has proof review and incident triage.

Messaging (admin and operations manager):

- [ ] Ops mobile and ops email.
- [ ] Toggles: SMS enabled, WhatsApp enabled, email enabled, dry-run, permit expiry alerts, agreement ending → ops, agreement ending → client SMS.
- [ ] **Save** persists.
- [ ] **Test SMS** and **Test WhatsApp** stay disabled until a mobile is entered.
- [ ] With dry-run on, a test adds a row under Recent outbound and does not send a live message.
- [ ] **Refresh alerts + dispatch queue** shows a dispatch summary.
- [ ] Recent outbound shows channel, status, template, destination, provider, IST time, error, and body. Empty state before any test.



## 16. Cross-cutting

- [ ] Every rupee amount uses Indian grouping. A 60000 rupee rate displays as ₹60,000.
- [ ] Every business date the user reads is `DD-MM-YYYY`. Every timestamp is IST.
- [ ] The three status badges never merge into one word.
- [ ] No screen offers Delete board. Retire is the only exit, and the row remains.
- [ ] At about 390px wide: filters wrap, tables scroll inside themselves, the Quick add dialog fits, and the dashboard does not force the whole page sideways.
- [ ] Search has a screen-reader label. Quick add is a dialog. Focus rings are visible. Badges include words, not colour alone.
- [ ] After publishing a face, the public listing has no client name, floor rate, printing, mounting, or cost.



## 17. One path that touches the product rules

Do this in order so later screens are not empty.

1. Create client QA Retail with a valid +91 mobile and reminders on.
2. Create board `QA-001`, lifecycle active, with GPS, face A at ₹60,000 card rate and a lower floor rate, and upload one photo.
3. Add a mandatory municipal licence that expires next month. Risk strip, Compliance, and Alerts all show expiring.
4. Add a second mandatory clearance that expired yesterday. The board badge becomes expired. Marketplace publish is blocked. As admin, grant a 7-day override, confirm the face can list, revoke it, and confirm it is blocked again.
5. Book face A from today through 60 days at the card rate. Occupancy becomes occupied. A second overlapping agreement fails.
6. Extend the end date. Revise as a new draft, activate the draft, then terminate it and confirm the face is free.
7. Manual-block the face for next week. It disappears from Availability for that week and shows as a red cell on the heat calendar.
8. Set the pre-listing window to 30 and put an agreement end inside that window. Confirm “Available from” on the face, on Vacancies, and on the dashboard.
9. Import the sample board CSV, then the same file again, and confirm the second run only skips.
10. Log a high-severity damage incident and move it to resolved. Confirm it on the board Incidents tab.
11. From Import → Photos, upload `QA-001_night.jpg` and confirm it on the gallery.
12. Export Excel and confirm four sheets and no floor rate.
13. Sign in as sales. Confirm no floor fields, no import and no settings in the nav, the dashboard says card rates only, and the public listing still hides the client and the floor rate.

