# CJ Private Tutoring Platform

## 1. Project Overview

Build a professional full-stack tutoring platform for CJ Private Tutoring.

The platform supports:

- Online tutoring
- In-person tutoring
- Exam preparation
- Individual lessons
- Group classes
- Student dashboards
- Tutor dashboards
- Admin/owner dashboards
- Parent dashboards
- Zoom live classes
- Attendance tracking
- Assignments
- Tests and examinations
- Automatic test marking where possible
- Student performance tracking
- Study materials
- Payments
- Invoices
- Notifications
- WhatsApp automation
- Email automation
- AI study assistant
- AI exam preparation
- Automated reminders

The application must be mobile-first because many students access the platform using smartphones.

---

# 2. Technology Stack

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Lucide React icons

Use Next.js App Router.

Do NOT create a separate React frontend.

---

## Backend

Use Next.js server-side functionality.

Use:

- Route Handlers
- Server Actions where appropriate
- Server Components where appropriate
- API routes under `src/app/api`

Do NOT create a separate Express backend unless explicitly requested.

---

## Database

Use MongoDB Atlas.

MongoDB Atlas provides:

- Managed MongoDB (document database)
- Automated backups
- Network / IP access control
- Database users and roles

Use Mongoose as the ODM. Define one schema per collection under `src/models`.

Open the connection through a cached helper in `src/lib/mongodb` so that Next.js hot
reload and serverless invocations reuse a single connection pool instead of opening a
new one per request.

The Atlas connection string is server-only. Never prefix it with `NEXT_PUBLIC_` and
never import it into a client component.

Atlas does NOT provide authentication, file storage, or row-level security. Those are
covered separately below.

## Authentication

Use NextAuth.js with the MongoDB adapter.

Hash passwords with bcrypt. Never store plain-text passwords.

Store the user role on the session so route handlers and middleware can authorize
without an extra database round trip.

---

# 3. Main User Roles

The system has four main roles.

## Student

Students can:

- Register/login
- View dashboard
- View lessons
- Join Zoom classes
- View attendance
- View assignments
- Submit assignments
- Take tests
- View results
- View performance
- Access study materials
- Use AI study assistant
- View payments
- View invoices
- Receive notifications

---

## Tutor

Tutors can:

- View assigned students
- Create lessons
- Schedule classes
- Create Zoom meetings
- Record attendance
- Create assignments
- Mark assignments
- Create tests
- Mark tests
- Upload study materials
- View student performance
- Send messages
- Give feedback

---

## Parent

Parents can:

- View linked students
- View attendance
- View academic performance
- View results
- View upcoming lessons
- View assignments
- View payment information
- Receive notifications

Parents must NOT have access to administrative functions.

---

## Admin / Owner

Admin can:

- Manage students
- Manage tutors
- Manage parents
- Manage subjects
- Manage grades
- Manage packages
- Manage pricing
- Manage classes
- Manage payments
- Manage invoices
- Manage attendance
- Manage tests
- Manage assignments
- Manage study materials
- Manage notifications
- Manage AI settings
- View business analytics

Admin has full system access.

---

# 4. Subjects

## Mathematics

Supported grades:

- Grade 8
- Grade 9
- Grade 10
- Grade 11
- Grade 12

## Physical Science

Supported grades:

- Grade 10
- Grade 11
- Grade 12

Do not allow unsupported grade/subject combinations.

---

# 5. Pricing

Pricing must be database-driven.

NEVER hard-code prices inside components.

Initial pricing:

## Individual tutoring

Online:

R200/hour

In-person:

R300/hour

## Exam preparation

Online:

R250/hour

In-person:

R350/hour

## Monthly packages

Starter:

R700/month

Standard:

R1,200/month

Premium:

R1,800/month

## Exam preparation packages

Online Exam Preparation:

R1,000

5 × 1-hour sessions

In-Person Exam Preparation:

R1,500

5 × 1-hour sessions

Intensive Exam Preparation:

R2,000

10 × 1-hour online sessions

## Group Classes

Initial price:

R500/month/student

All pricing must be editable by the admin.

---

# 6. Core Business Flow

Student registration:

Registration
→ Authentication
→ Select grade
→ Select subject
→ Select package
→ Payment
→ Account activation
→ Student dashboard

---

# 7. Lesson Flow

Admin/tutor creates lesson:

Student
→ Subject
→ Grade
→ Lesson type
→ Date
→ Time
→ Duration
→ Zoom meeting
→ Student notification

Student:

Dashboard
→ Upcoming lesson
→ Join Zoom
→ Attend lesson

After lesson:

Attendance
→ Assignment
→ Feedback
→ Performance tracking

---

# 8. Zoom

Zoom is responsible for:

- Webcam
- Microphone
- Video
- Audio
- Screen sharing
- Live classroom

DO NOT build WebRTC/video infrastructure.

DO NOT build a custom webcam system.

The application should store:

- Zoom meeting ID
- Join URL
- Start URL
- Start time
- Duration
- Meeting status

Students should be able to click:

"Join Zoom Class"

and be redirected to the Zoom meeting.

---

# 9. Student Dashboard

Student dashboard must contain:

- Overview
- Today's lesson
- Upcoming lessons
- Join class
- Subjects
- Assignments
- Tests
- Results
- Performance
- Attendance
- Study materials
- AI Study Assistant
- Payments
- Invoices
- Notifications
- Profile

The dashboard must be optimized for mobile phones.

---

# 10. Tutor Dashboard

Tutor dashboard:

- Overview
- Today's classes
- Upcoming classes
- Students
- Schedule
- Attendance
- Assignments
- Tests
- Marking
- Results
- Student performance
- Study materials
- Messages
- Profile

---

# 11. Admin Dashboard

Admin dashboard:

- Total students
- Active students
- Total tutors
- Monthly revenue
- Outstanding payments
- Upcoming classes
- Attendance statistics
- Academic performance
- New registrations
- Package sales

Navigation:

Dashboard
Students
Tutors
Parents
Classes
Subjects
Grades
Packages
Pricing
Assignments
Tests
Results
Materials
Payments
Invoices
Notifications
AI
Reports
Settings

---

# 12. Academic System

The academic system must support:

- Assignments
- Tests
- Exams
- Questions
- Answers
- Marks
- Results
- Feedback
- Performance
- Progress tracking

Test types:

- Multiple choice
- True/false
- Short answer
- Numerical questions

Automatically mark objective questions.

Allow tutors to manually mark subjective questions.

---

# 13. Performance System

Track:

- Average percentage
- Subject performance
- Topic performance
- Test performance
- Assignment performance
- Attendance
- Improvement over time

Example:

Student:

Mathematics

Average: 72%

Attendance: 94%

Weak topic:

Calculus

Physical Science

Average: 65%

Weak topic:

Mechanics

---

# 14. Attendance

Attendance statuses:

- Present
- Absent
- Late
- Excused

Store:

- Student
- Class
- Date
- Status
- Check-in time
- Notes

Calculate attendance percentage automatically.

---

# 15. Assignments

Tutor creates:

- Title
- Description
- Subject
- Grade
- Due date
- Questions
- Files

Student can:

- View assignment
- Download files
- Submit answers/files
- View feedback
- View mark

Notify students before deadlines.

---

# 16. Study Materials

Materials can include:

- PDFs
- Notes
- Images
- Videos
- Worksheets
- Past papers

Organize by:

Grade
→ Subject
→ Topic
→ Material

Example:

Grade 12
→ Mathematics
→ Calculus
→ Integration Notes

Store files in Cloudinary. Keep only the Cloudinary URL and public_id in MongoDB,
alongside the file metadata.

Upload from route handlers using the `cloudinary` server SDK, or from the browser
using `next-cloudinary` with a signed upload. Never expose CLOUDINARY_API_SECRET
to the browser.

Do not store binary file data inside MongoDB documents.

---

# 17. AI Study Assistant

The AI assistant should help students:

- Explain concepts
- Generate practice questions
- Explain mistakes
- Create revision plans
- Help with exam preparation
- Generate quizzes
- Summarize study materials
- Identify weak topics

Supported subjects:

Mathematics Grade 8–12

Physical Science Grade 10–12

The AI must NOT replace the tutor.

Display a disclaimer that AI-generated answers should be verified with the tutor/materials where appropriate.

---

# 18. AI Exam Preparation

AI can generate:

- Practice tests
- Revision questions
- Topic quizzes
- Study plans
- Exam simulations
- Weak-topic exercises

Example:

Student performance:

Calculus = 42%

Algebra = 78%

Functions = 65%

AI should recommend additional Calculus practice.

---

# 19. Payments

The payment system must support:

- Package payments
- Monthly payments
- Individual lesson payments
- Exam preparation payments
- Group class payments

Track:

- Amount
- Payment status
- Payment date
- Student
- Package
- Reference
- Provider

Statuses:

- Pending
- Paid
- Failed
- Refunded

Never mark a payment as successful based only on frontend input.

Use provider webhooks.

---

# 20. Invoices

Generate invoices after successful payment.

Invoice contains:

- Invoice number
- Student
- Parent where applicable
- Package
- Amount
- Date
- Payment status

---

# 21. Notifications

Notifications can be sent through:

- Email
- WhatsApp
- In-app notifications

Automate:

- Lesson reminders
- Class starting reminders
- Assignment deadlines
- Test availability
- Test results
- Payment reminders
- Payment confirmations
- New materials
- Tutor messages

---

# 22. WhatsApp Automation

WhatsApp should be used for notifications such as:

"Your Mathematics lesson starts at 14:00 today."

"Your assignment is due tomorrow."

"Your payment has been received."

"Your test result is available."

Do not send spam.

Respect user consent and WhatsApp policies.

---

# 23. Email

Use transactional email for:

- Account verification
- Password reset
- Payment confirmation
- Invoice
- Lesson reminder
- Assignment notification
- Test result

Never expose SMTP/API credentials to the client.

Store credentials in environment variables.

---

# 24. Database Entities

Main tables:

users

profiles

students

parents

tutors

parent_students

subjects

grades

student_subjects

packages

package_features

pricing

subscriptions

classes

class_students

class_tutors

attendance

assignments

assignment_submissions

tests

questions

test_attempts

answers

results

performance

topics

study_materials

payments

invoices

notifications

messages

ai_conversations

ai_messages

zoom_meetings

audit_logs

---

# 25. Database Security

MongoDB has no row-level security. Authorization must be enforced in the service layer
on every query.

Scope every query by the authenticated user's id and role, taken from the session.
Never trust a user id sent from the client.

Students can only access their own:

- Profile
- Classes
- Attendance
- Assignments
- Results
- Performance
- Payments
- Notifications
- AI conversations

Tutors can only access:

- Assigned students
- Assigned classes
- Their academic content

Parents can only access linked students.

Admins can access everything.

Never rely only on frontend role checks.

Always enforce authorization server-side/database-side.

---

# 26. Project Structure

Use:

src/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── student/
│   ├── tutor/
│   ├── parent/
│   ├── admin/
│   └── ...
│
├── components/
├── lib/
├── services/
├── validations/
├── types/
├── hooks/
└── utils/

Use Route Handlers under:

src/app/api/

Example:

src/app/api/students/route.ts

src/app/api/classes/route.ts

src/app/api/payments/route.ts

src/app/api/ai/chat/route.ts

---

# 27. Coding Rules

Use TypeScript.

Avoid \`any\`.

Use strict typing.

Use reusable components.

Use server components by default.

Use client components only when interactivity requires them.

Do not put business logic directly inside UI components.

Keep business logic inside services.

Validate all API input.

Handle errors consistently.

Do not expose secrets.

Do not hard-code credentials.

Do not hard-code pricing.

Do not duplicate business logic.

---

# 28. Environment Variables

Use:

MONGODB_URI=

NEXTAUTH_SECRET=

NEXTAUTH_URL=

PAYSTACK_SECRET_KEY=

NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=

PAYPAL_CLIENT_ID=

PAYPAL_CLIENT_SECRET=

GMAIL_USER=

GMAIL_APP_PASSWORD=

ZOOM_CLIENT_ID=

ZOOM_CLIENT_SECRET=

ZOOM_ACCOUNT_ID=

AI_API_KEY=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=

NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

WHATSAPP_ACCESS_TOKEN=

WHATSAPP_PHONE_NUMBER_ID=

Never commit \`.env\`.

Never expose server secrets using \`NEXT_PUBLIC_\`.

---

# 29. UI Design

Use:

- Tailwind CSS
- shadcn/ui
- Lucide icons
- Responsive layouts
- Accessible components
- Mobile-first design

Students primarily use smartphones.

Therefore:

- Large buttons
- Easy navigation
- Simple dashboard
- Large "Join Class" button
- Easy file uploads
- Minimal typing
- Bottom navigation where appropriate

---

# 30. Development Strategy

Build in this order:

Phase 1:

Authentication
Roles
MongoDB Atlas connection
Student profiles
Subjects
Grades

Phase 2:

Student dashboard
Tutor dashboard
Admin dashboard

Phase 3:

Classes
Scheduling
Zoom integration
Attendance

Phase 4:

Assignments
Tests
Results
Performance

Phase 5:

Study materials

Phase 6:

Packages
Pricing
Payments
Invoices

Phase 7:

Email
WhatsApp
Notifications
Automation

Phase 8:

AI Study Assistant

Phase 9:

AI Exam Preparation

Phase 10:

Reports
Analytics
Parent dashboard

Do not build everything at once.

Complete and test each phase before moving to the next.

---

# 31. Important Business Rule

The platform is not just a video-call application.

Zoom handles the live teaching.

The platform handles:

Student management
+
Academic management
+
Payments
+
Attendance
+
Performance
+
Communication
+
AI assistance
+
Business management

This is the core product.

---

# 32. Before Writing Code

Before implementing a feature:

1. Understand the existing architecture.
2. Inspect related files.
3. Reuse existing components/services.
4. Check database relationships.
5. Check authorization.
6. Check mobile responsiveness.
7. Implement the smallest clean solution.
8. Test the feature.
9. Fix TypeScript errors.
10. Do not unnecessarily rewrite working code.

---

# 33. Never Do This

Do NOT:

- Create an Express backend.
- Create a separate React frontend.
- Build custom WebRTC video.
- Hard-code prices.
- Put secrets in frontend code.
- Expose MONGODB_URI or query MongoDB from client components.
- Trust frontend authorization.
- Store passwords in plain text.
- Commit \`.env\`.
- Create unnecessary dependencies.
- Rewrite the entire application to implement one feature.
- Delete working features without explicit instruction.

---

# 34. Definition of Done

A feature is not complete until:

- TypeScript passes
- No obvious console errors
- API validation works
- Authorization works
- Database operations work
- Loading states exist
- Error states exist
- Empty states exist
- Mobile layout works
- Desktop layout works where relevant
- Security considerations are handled
- Existing functionality still works

Always prioritize correctness, security, maintainability and mobile usability.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
