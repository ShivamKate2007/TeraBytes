# User & Role-Based Platform Roadmap

Smart Supply Chain is moving from a single dashboard application into a role-based logistics platform. This roadmap defines how Admin, Supply Chain Manager, Warehouse Manager, Distributor Manager, Retailer Receiver, Driver, Carrier Partner, and Analyst users will access the existing features and the new contract/notification features.

## 1. Product Direction

### Goal
Build a full-fledged smart supply chain system where every stakeholder sees only the information and actions relevant to their operational responsibility.

### Core Principle
Frontend role-based UI improves usability, but backend authorization is the real source of truth.

Every protected API must answer three questions:

1. Who is the user?
2. What role do they have?
3. Which shipments, contracts, nodes, routes, disruptions, or analytics are they allowed to access?

## 2. User Types And Roles

| User Type | Role | Purpose |
|---|---|---|
| Admin | System Admin | Full control: users, shipments, routes, contracts, disruptions |
| User | Supply Chain Manager | Oversees all shipments, accepts reroutes, monitors KPIs |
| User | Warehouse Manager | Manages arrivals/departures at a warehouse |
| User | Distributor Manager | Handles shipments assigned to distributor/DC |
| User | Retailer Receiver | Confirms received goods, views incoming ETAs |
| User | Driver | Sees assigned route, alerts, reroute instructions |
| User | Carrier / Transport Partner | Manages fleet, drivers, contracts, and transport execution |
| User | Analyst / Viewer | Read-only analytics and reports |

## 3. Role Access Matrix

| Feature | Admin | Supply Chain Manager | Warehouse Manager | Distributor Manager | Retailer Receiver | Driver | Carrier Partner | Analyst |
|---|---|---|---|---|---|---|---|---|
| Dashboard KPIs | Full | Full | Own facility | Own shipments | Incoming only | Assigned only | Fleet/contracts | Full read-only |
| Shipment list | Full | Full | Related warehouse | Related DC | Incoming retail | Assigned shipments | Carrier-assigned shipments | Read-only |
| Shipment detail | Full | Full | Related shipments | Related shipments | Incoming only | Assigned only | Carrier-assigned shipments | Read-only |
| Live map | Full | Full | Facility region | Own routes | Incoming route | Own route | Fleet routes | Read-only |
| What-if simulator | Full | Full | Limited facility scenarios | Limited DC scenarios | No/limited | No | Fleet impact sandbox | Read-only sandbox |
| Reroute suggestions | Approve/apply | Approve/apply | Recommend only | Recommend only | View impact | View assigned reroute | Recommend/request | View only |
| Apply reroute | Yes | Yes | No, unless delegated | No, unless delegated | No | No | No, unless delegated | No |
| Disruption detection | Yes | Yes | View/create local incident | View/create local incident | Report incident | Report incident | Report fleet incident | View only |
| News/weather alerts | Full | Full | Relevant region | Relevant region | Incoming impact | Assigned route only | Fleet route impact | Full read-only |
| Analytics | Full | Full | Warehouse analytics | DC analytics | Delivery analytics | Own performance | Fleet performance | Full read-only |
| Contracts | Full | Create/manage | Handoff/receive | Accept/fulfill | Receive/confirm | Execute trip | Accept/manage assigned contracts | Read-only |
| User management | Full | Limited invite maybe | No | No | No | No | Manage own drivers only | No |
| Notifications | Full | Full operational | Facility notifications | DC notifications | Delivery notifications | Route/task notifications | Fleet notifications | Read-only alerts |
| Event timeline | Full | Full | Related handoffs | Related handoffs | Incoming delivery events | Assigned route events | Fleet events | Read-only |
| Reports/export | Full | Full | Own facility | Own DC | Own deliveries | Own trips | Fleet reports | Full read-only |

## 4. Existing Feature Access Rules

### 4.1 Dashboard KPIs

Backend should calculate KPIs according to role scope.

- Admin: all shipments and disruptions.
- Supply Chain Manager: all active operational shipments.
- Warehouse Manager: shipments where their assigned warehouse appears in the route or current stage.
- Distributor Manager: shipments where their assigned distributor/DC appears in the route or current stage.
- Retailer Receiver: shipments whose destination retailer belongs to them.
- Driver: shipments assigned to that driver.
- Carrier Partner: shipments assigned to their carrier organization.
- Analyst: all KPIs, read-only.

### 4.2 Shipment List

Do not create separate shipment APIs for every role. Keep one endpoint and filter results server-side.

Example:

```txt
GET /api/shipments
```

Expected behavior:

- Admin gets all shipments.
- Driver gets only assigned shipments.
- Warehouse Manager gets only shipments connected to assigned warehouse nodes.
- Retailer gets only incoming/received shipments.

### 4.3 Shipment Detail

```txt
GET /api/shipments/{shipment_id}
```

Access should be allowed only if the shipment is inside the user's scope.

### 4.4 Live Map

Map data should be filtered.

- Admin/Supply Chain Manager: complete network.
- Warehouse Manager: assigned facility and related routes.
- Distributor: assigned DC routes.
- Retailer: inbound route to retail node.
- Driver: assigned shipment route only.
- Analyst: read-only complete or scoped view depending on configuration.

### 4.5 What-If Simulator

Simulator must not be equally powerful for everyone.

- Admin/Supply Chain Manager: full simulator.
- Warehouse Manager: can simulate disruptions near own facility.
- Distributor Manager: can simulate DC-related disruptions.
- Carrier Partner: can simulate fleet impact but cannot apply reroute directly unless delegated.
- Analyst: sandbox/read-only simulation.
- Driver/Retailer: no full simulator; they only view impact or instructions.

### 4.6 Reroute Suggestions

Reroute suggestion generation can be visible to many roles, but approval must be limited.

- Admin/Supply Chain Manager: approve/apply.
- Warehouse/Distributor/Carrier: recommend/request reroute.
- Driver: view assigned reroute instruction.
- Retailer: view delivery impact only.
- Analyst: view only.

### 4.7 Disruption Detection

Disruption detection has two paths:

1. Automatic external detection from weather/news.
2. Human incident reporting.

Role behavior:

- Admin/Supply Chain Manager: trigger detection, review events, resolve events.
- Warehouse/Distributor: create local incidents for their facility.
- Driver: report incident on route.
- Retailer: report delivery-side issue.
- Analyst: read-only.

### 4.8 News/Weather Alerts

External news/weather should only become operational alerts if it affects shipment routes.

Rules:

- News/weather markers appear on dashboard.
- Dashboard does not directly apply optimized routes.
- What-if simulator handles route optimization.
- Low-confidence news should go to review queue, not directly to active disruption.

### 4.9 Analytics

Analytics must be role-specific.

- Admin: network-wide performance.
- Supply Chain Manager: operations, risk, reroute, SLA.
- Warehouse Manager: dwell time, arrivals, departures, missed handoffs.
- Distributor Manager: dispatch load, DC delays, fulfillment reliability.
- Retailer Receiver: incoming delivery reliability.
- Driver: assigned trip performance, delay causes.
- Carrier Partner: fleet performance, driver performance, contract SLA.
- Analyst: full read-only analytics.

## 5. New Feature: Authentication And Authorization

### 5.1 User Model

Collection/table: `users`

```json
{
  "id": "USR-001",
  "email": "manager@example.com",
  "name": "Aarav Sharma",
  "role": "warehouse_manager",
  "organizationId": "ORG-PUNE-WH",
  "assignedNodeIds": ["pune_wh"],
  "assignedShipmentIds": [],
  "assignedDriverIds": [],
  "status": "active",
  "createdAt": "2026-04-26T00:00:00Z",
  "updatedAt": "2026-04-26T00:00:00Z"
}
```

### 5.2 Organization Model

Collection/table: `organizations`

```json
{
  "id": "ORG-001",
  "name": "Pune Central Warehouse",
  "type": "warehouse",
  "nodeIds": ["pune_wh"],
  "contactEmail": "ops@pune-wh.example.com",
  "status": "active"
}
```

Organization types:

- admin_operator
- manufacturer
- warehouse
- distributor
- retailer
- carrier
- analytics_partner

### 5.3 Auth Approach

Implementation should start with a dev-friendly role selector, then support Firebase Auth later.

Step 1: Dev auth header

```txt
X-User-Id: USR-001
```

Step 2: Backend reads user from Firestore.

Step 3: Frontend stores selected dev user in localStorage.

Step 4: Later replace with Firebase Auth token verification.

### 5.4 Backend Authorization Helpers

Create helpers:

```python
get_current_user()
require_role(...)
can_view_shipment(user, shipment)
can_apply_reroute(user, shipment)
can_view_contract(user, contract)
can_manage_contract(user, contract)
can_report_incident(user, location_or_node)
```

## 6. New Feature: Role-Based Frontend Shell

### 6.1 Login / User Switcher

Initial hackathon-friendly approach:

- Dev login screen with seeded users.
- Select role/user.
- Store user in localStorage.
- Attach `X-User-Id` to API calls.

### 6.2 Role-Based Sidebar

Routes by role:

| Page | Admin | SCM | Warehouse | Distributor | Retailer | Driver | Carrier | Analyst |
|---|---|---|---|---|---|---|---|---|
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Shipments | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Read-only |
| What-if Simulator | Yes | Yes | Limited | Limited | No | No | Limited | Sandbox |
| Analytics | Yes | Yes | Scoped | Scoped | Scoped | Own | Fleet | Yes |
| Contracts | Yes | Yes | Handoff | Fulfill | Confirm | Execute | Manage | Read-only |
| Users | Yes | Limited | No | No | No | No | Drivers only | No |
| Notifications | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

### 6.3 Access Denied Page

If a role opens a restricted route, show:

```txt
You do not have permission to access this workspace.
Contact your supply chain administrator if this is unexpected.
```

## 7. New Feature: Contracts

### 7.1 Contract Concept

A contract represents operational responsibility for moving or handling a shipment. It should not magically transfer cargo. It should define who is responsible for each stage and SLA.

### 7.2 Contract Model

Collection/table: `contracts`

```json
{
  "id": "CTR-001",
  "shipmentId": "SHP-001",
  "contractType": "transport_order",
  "createdBy": "USR-SCM-001",
  "carrierOrgId": "ORG-CARRIER-001",
  "driverId": "USR-DRIVER-001",
  "originNodeId": "mumbai_mfg",
  "destinationNodeId": "retailer_delhi",
  "mandatoryStopNodeIds": ["nagpur_hub", "kolkata_dc"],
  "slaDeliveryAt": "2026-04-27T18:00:00Z",
  "price": 45000,
  "currency": "INR",
  "status": "accepted",
  "penaltyRules": {
    "lateDeliveryPerHour": 500
  },
  "createdAt": "2026-04-26T00:00:00Z",
  "acceptedAt": "2026-04-26T01:00:00Z",
  "completedAt": null
}
```

### 7.3 Contract Statuses

```txt
draft
sent
accepted
assigned_driver
in_progress
handoff_pending
completed
breached
cancelled
rejected
```

### 7.4 Contract APIs

```txt
GET    /api/contracts
POST   /api/contracts
GET    /api/contracts/{contract_id}
PATCH  /api/contracts/{contract_id}
POST   /api/contracts/{contract_id}/send
POST   /api/contracts/{contract_id}/accept
POST   /api/contracts/{contract_id}/reject
POST   /api/contracts/{contract_id}/assign-driver
POST   /api/contracts/{contract_id}/start
POST   /api/contracts/{contract_id}/complete
POST   /api/contracts/{contract_id}/cancel
```

### 7.5 Contract UI

Pages:

- Contract List
- Contract Detail
- Create Contract
- Assign Driver
- Contract SLA View
- Contract Event Timeline
- Contract Breach/Delay Explanation

### 7.6 Contract Role Behavior

- Admin: full control.
- Supply Chain Manager: create/manage contracts.
- Carrier Partner: accept/reject contracts, assign drivers.
- Driver: execute assigned contract trip.
- Warehouse Manager: confirm handoff/arrival/departure.
- Distributor Manager: confirm distribution handoff.
- Retailer Receiver: confirm final delivery.
- Analyst: read-only.

## 8. New Feature: Notifications

### 8.1 Notification Model

Collection/table: `notifications`

```json
{
  "id": "NOTIF-001",
  "userId": "USR-001",
  "role": "warehouse_manager",
  "type": "shipment_arrival",
  "title": "Shipment arriving soon",
  "message": "SHP-001 is expected at Pune Warehouse in 45 minutes.",
  "shipmentId": "SHP-001",
  "contractId": "CTR-001",
  "read": false,
  "createdAt": "2026-04-26T00:00:00Z"
}
```

### 8.2 Notification Events

Generate notifications when:

- Shipment is created.
- Contract is sent.
- Contract is accepted/rejected.
- Driver is assigned.
- Shipment departs a node.
- Shipment approaches warehouse/distributor/retailer.
- Shipment arrives at a mandatory stop.
- Shipment leaves a mandatory stop.
- Shipment is affected by disruption.
- Reroute suggestion is created.
- Reroute is approved/applied.
- Delivery is completed.
- SLA breach risk detected.

### 8.3 Notification APIs

```txt
GET  /api/notifications
POST /api/notifications/{notification_id}/read
POST /api/notifications/read-all
```

### 8.4 Frontend Notification Center

- Bell icon with unread count.
- Role-specific notification list.
- Click notification opens related shipment/contract/disruption.

## 9. New Feature: Event Timeline

### 9.1 Shipment Event Model

Collection/table: `shipment_events`

```json
{
  "id": "EVT-001",
  "shipmentId": "SHP-001",
  "contractId": "CTR-001",
  "type": "arrived_warehouse",
  "nodeId": "pune_wh",
  "actorUserId": "USR-WH-001",
  "message": "Shipment arrived at Pune Warehouse.",
  "metadata": {},
  "createdAt": "2026-04-26T00:00:00Z"
}
```

### 9.2 Event Types

```txt
shipment_created
contract_created
contract_sent
contract_accepted
driver_assigned
departed_node
arrived_node
handoff_confirmed
reroute_suggested
reroute_approved
reroute_applied
disruption_detected
weather_alert
news_alert
sla_risk_detected
delivered
contract_completed
```

### 9.3 Timeline UI

Shipment detail should show:

- Stage roadmap.
- Current GPS/location.
- Route map.
- Event timeline.
- Contract linked to shipment.
- Responsible users/organizations at each stage.

## 10. New Feature: Human Incident Reporting

### 10.1 Incident Report Model

Collection/table: `incident_reports`

```json
{
  "id": "INC-001",
  "reportedBy": "USR-DRIVER-001",
  "role": "driver",
  "shipmentId": "SHP-001",
  "type": "accident",
  "description": "Road blocked near Dhanbad bypass.",
  "location": {"lat": 23.7957, "lng": 86.4304, "radius": 15},
  "status": "pending_review",
  "createdAt": "2026-04-26T00:00:00Z"
}
```

### 10.2 Incident Flow

1. Driver/Warehouse/Distributor/Retailer reports incident.
2. Admin/Supply Chain Manager reviews.
3. If accepted, incident becomes active disruption.
4. Reroute suggestions are generated.
5. Relevant users are notified.

### 10.3 APIs

```txt
POST /api/incidents/report
GET  /api/incidents
POST /api/incidents/{id}/approve
POST /api/incidents/{id}/reject
```

## 11. New Feature: External Event Review Queue

### Purpose
Prevent low-quality news from directly polluting active disruptions.

### Flow

1. News/weather detector extracts potential incident.
2. Incident gets confidence score.
3. If high confidence and affects active route, mark as active disruption.
4. If medium confidence, send to review queue.
5. If low confidence, ignore.

### Event Fields

```json
{
  "id": "EXT-001",
  "source": "news_api_live",
  "title": "Flooding reported near Goregaon",
  "incidentType": "flood",
  "locationName": "Goregaon",
  "location": {"lat": 19.1649, "lng": 72.8493, "radius": 18},
  "confidence": 0.82,
  "affectedShipmentIds": [],
  "status": "pending_review"
}
```

## 12. Backend Implementation Roadmap

### Phase 9A: Auth Foundation

- Add user model.
- Add organization model.
- Seed demo users.
- Add current user dependency.
- Add dev auth header support.
- Add API response for current user.

Endpoints:

```txt
GET /api/auth/me
GET /api/auth/dev-users
```

### Phase 9B: Permission Layer

- Create `app/services/access_control.py`.
- Add permission helpers.
- Gate shipment APIs.
- Gate simulator APIs.
- Gate analytics APIs.
- Gate reroute APIs.
- Gate contract APIs.

### Phase 9C: Scoped Data APIs

- Filter `/api/shipments` by role.
- Filter `/api/disruptions` by role/location relevance.
- Filter `/api/analytics/kpis` by role.
- Filter `/api/analytics/trends` by role.
- Filter `/api/disruptions/reroute-suggestions` by role.

### Phase 9D: Contracts Backend

- Add contract model.
- Add contracts router.
- Add contract lifecycle actions.
- Link contract to shipment.
- Add contract permissions.
- Add carrier, vehicle, and driver profile foundation.
- Add driver assignment and transporter reliability snapshots.
- Add driver performance fields: on-time score, no-damage score, route compliance, incident-free score, completed trip history.
- Scope driver visibility by role:
  - Admin/Supply Chain Manager: all drivers.
  - Carrier Partner: own drivers/fleet only.
  - Driver: own profile only.
  - Warehouse/Distributor/Retailer: drivers connected to related contracts/shipments.
  - Analyst: read-only.

### Phase 9E: Notifications Backend

- Add notification model.
- Add notification service.
- Add notification router.
- Trigger notifications from shipment movement, contracts, disruptions, reroutes.

### Phase 9F: Incident Reporting Backend

- Add incident report model.
- Add incident router.
- Add review workflow.
- Convert approved incident to disruption.

### Phase 9G: External Event Review Backend

- Improve NewsAPI parsing.
- Add confidence scoring.
- Add review queue.
- Prevent duplicate stale disruptions.
- Add cleanup endpoint for legacy mock disruptions.

### Phase 9H: Analytics Backend

- Add role-scoped analytics.
- Add contract SLA analytics.
- Add warehouse dwell analytics.
- Add driver performance analytics.
- Add disruption impact analytics.

## 13. Frontend Implementation Roadmap

### Phase 9I: Auth UI

- Add login/dev user selector page.
- Add `AuthContext`.
- Store selected user.
- Attach `X-User-Id` to every API call.
- Add logout/switch user.

### Phase 9J: Role-Based Layout

- Role-aware sidebar.
- Role-aware topbar.
- Access denied page.
- Route guards.
- Role badge in UI.

### Phase 9K: Role Dashboards

Build dashboard variations:

- Admin dashboard.
- Supply Chain Manager dashboard.
- Warehouse Manager dashboard.
- Distributor Manager dashboard.
- Retailer Receiver dashboard.
- Driver dashboard.
- Carrier Partner dashboard.
- Analyst dashboard.

### Phase 9L: Contracts UI

- Contract list page.
- Contract detail page.
- Create contract form.
- Accept/reject contract actions.
- Assign driver action.
- Complete contract action.
- Contract SLA indicator.
- Contract timeline.

### Phase 9M: Notifications UI

- Notification bell.
- Notification center page.
- Mark as read.
- Notification deep links.

### Phase 9N: Incident Reporting UI

- Report incident form.
- Driver incident button.
- Warehouse local incident report.
- Admin review queue.
- Approve/reject incident.

### Phase 9O: Analytics UI Upgrade

- Add explanation below every chart.
- Add role-specific analytics cards.
- Add contract SLA chart.
- Add delay cause chart.
- Add disruption source chart.
- Add warehouse dwell chart.
- Add driver performance chart.

## 14. Phase 10 Real-Time Operational Flow

### 10A: Shipment Movement

- Movement only runs when backend is online.
- Movement resumes from last saved position.
- ETA updates from current position.
- Route progress is saved in backend.
- Stage updates when shipment reaches nodes.

### 10B: Handoff Workflow

- Warehouse manager confirms arrival.
- Warehouse manager confirms departure.
- Distributor confirms receipt/dispatch.
- Retailer confirms delivery.
- Driver sees current assignment.

### 10C: Notification Automation

- Approaching warehouse notification.
- Delayed shipment notification.
- Contract SLA risk notification.
- Reroute pending approval notification.
- Delivery completed notification.

### 10D: Approval Workflow

- Driver can request reroute.
- Carrier can recommend reroute.
- Warehouse/Distributor can recommend reroute.
- Admin/Supply Chain Manager approves reroute.
- Applied reroute updates shipment and contract timeline.

## 15. Phase 11 Final Hero Deliverables

- Final README.
- Architecture diagram.
- Role-based demo users.
- Seed contracts.
- Seed notifications.
- API documentation.
- Demo script.
- Frontend build verification.
- Backend smoke tests.
- Final GitHub push.
- Optional deployment.

## 16. Recommended Build Order

1. Seed demo users and organizations.
2. Add backend auth/user dependency.
3. Add frontend dev login/user selector.
4. Add role-scoped shipment API.
5. Add role-aware dashboard/sidebar.
6. Add contract backend.
7. Add contract frontend.
8. Add notification backend.
9. Add notification frontend.
10. Add incident reporting backend.
11. Add incident reporting frontend.
12. Add external event review queue.
13. Upgrade analytics.
14. Connect movement events to notifications/contracts.
15. Final QA and demo polish.

## 17. Definition Of Done

A feature is done only when:

- Backend API exists.
- Backend authorization is enforced.
- Frontend role UI exists.
- Empty/loading/error states exist.
- It works for at least Admin and one restricted role.
- Smoke test passes.
- It is documented in this roadmap or project README.

## 18. Notes For Future Us

- Do not rely only on frontend hiding for security.
- Do not let drivers/admin-only actions leak into driver UI.
- Do not auto-apply reroutes from news/weather.
- Do not allow mock news to create real disruptions.
- Do not skip mandatory operational stops like warehouse/DC/retailer.
- Do not magically transfer shipment origin during reroute.
- Contracts should represent operational responsibility, not physical teleportation.
