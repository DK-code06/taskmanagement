# Data Model & Migration Plan

**Date**: September 29, 2026  
**Target Architecture**: Modular Monolith  
**Objective**: Safely transform legacy schemas into the target data hierarchy (`Project` → `Milestone` → `Task` → `Subtask`) without data loss.

---

## 1. Target Data Schemas

### 1.1 User Model (`models/User.js`)
```javascript
{
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  timezone: { type: String, default: "UTC" },
  skills: [{ type: String, trim: true }],
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastCompletionDate: { type: Date, default: null },
  sessionVersion: { type: Number, default: 1 },
  notificationPreferences: {
    taskAssigned: { type: Boolean, default: true },
    taskDueSoon: { type: Boolean, default: true },
    overdueTask: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    friendRequests: { type: Boolean, default: true },
    teamInvitations: { type: Boolean, default: true },
    chatMessages: { type: Boolean, default: true },
    rewards: { type: Boolean, default: true }
  },
  friends: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'sent', 'accepted'], required: true },
    unreadCount: { type: Number, default: 0 }
  }],
  deletedAt: { type: Date, default: null }
}, { timestamps: true }
```

---

### 1.2 Project Model (`models/Project.js`) - [NEW]
```javascript
{
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  ownerType: { type: String, enum: ['User', 'Team'], required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'ownerType' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' }
  }],
  status: { type: String, enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'], default: 'ACTIVE' },
  deadline: { type: Date, default: null },
  tags: [{ type: String, trim: true }],
  deletedAt: { type: Date, default: null }
}, { timestamps: true }
```

---

### 1.3 Milestone Model (`models/Milestone.js`) - [NEW]
```javascript
{
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  dueDate: { type: Date, default: null },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'], default: 'PLANNED' }
}, { timestamps: true }
```

---

### 1.4 Task Model (`models/Task.js`) - [UPDATED]
```javascript
{
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', default: null, index: true },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null, index: true }, // Subtask
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  status: { type: String, enum: ['READY', 'BLOCKED', 'IN_PROGRESS', 'COMPLETED'], default: 'READY' },
  priority: { type: String, enum: ['High', 'Medium', 'Low', 'No Priority'], default: 'No Priority' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  tags: [{ type: String, trim: true }],
  dueDate: { type: Date, default: null },
  estimatedMinutes: { type: Number, default: 0 },
  actualMinutes: { type: Number, default: 0 },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  order: { type: Number, default: 0 },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  rewardGranted: { type: Boolean, default: false },
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
  deletedAt: { type: Date, default: null }
}, { timestamps: true }
```

---

### 1.5 Team & Invitation Models (`models/Team.js`, `models/Invitation.js`)
```javascript
// Team Schema
{
  name: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' }
  }]
}, { timestamps: true }

// Invitation Schema - [NEW]
{
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'], default: 'PENDING' },
  expiresAt: { type: Date, required: true }
}, { timestamps: true }
```

---

### 1.6 Audit & Activity Event Systems - [NEW]
```javascript
// AuditLog (Append-Only)
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true }, // e.g., LOGIN_SUCCESS, PERMISSION_DENIED
  ipAddress: { type: String },
  userAgent: { type: String },
  details: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true }

// ActivityEvent (Source of Truth for Analytics & Debt)
{
  eventType: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true }

// RewardEvent (Idempotency Enforcement)
{
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, required: true },
  reason: { type: String, required: true }
}, { timestamps: true })
// Unique index on (taskId, reason)
```

---

## 2. Category → Project Migration Strategy

Every legacy `Category` document will be migrated to a `Project` document:

1. **Category Mapping**:
   - `Category._id` → Preserved or mapped to new `Project._id`.
   - `Category.name` → `Project.name`.
   - `Category.ownerType` & `Category.ownerId` → `Project.ownerType` & `Project.ownerId`.
   - Category name added as a default entry in `Project.tags` array (e.g. Tag: `"College"`).

2. **Task Schema Migration**:
   - `Task.category` → Renamed/mapped to `Task.projectId`.
   - Legacy status `'To Do'` mapped to `'READY'`.
   - Legacy status `'In Progress'` mapped to `'IN_PROGRESS'`.
   - Legacy status `'Done'` mapped to `'COMPLETED'`.
   - `Task.user` mapped to `Task.createdBy`.
   - Default `estimatedMinutes` initialized to 0.

3. **Idempotency**:
   - The migration script checks for existing migrated `Project` records matching legacy `Category` IDs before inserting, ensuring it can run multiple times without duplicating data.

---

## 3. Migration Safety Protocols

Before executing any production migration:
1. **Pre-Migration Snapshot**: Record collection document counts (`Users`, `Categories`, `Tasks`, `Teams`, `Messages`).
2. **Dry-Run Mode**: Execute script with `--dry-run` flag to log projected schema transformations without mutating MongoDB documents.
3. **Execution**: Perform live migration inside a Mongoose session / MongoDB transaction.
4. **Post-Migration Verification**:
   - Verify post-migration document counts match pre-migration counts.
   - Verify all `Task.projectId` references point to existing `Project` documents.
   - Sample 10 random tasks and verify relationships, tags, and user IDs.
5. **Rollback Script**: Maintain a versioned rollback script (`down`) capable of restoring legacy collection references if post-verification fails.
