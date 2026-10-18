# SmartNekam — Product Requirements Document (PRD)

**Product:** SmartNekam  
**Tagline:** *Soma, Ungana, Pata Fursa.*  
**Version:** 1.0  
**Date:** October 15, 2026  
**Owner:** Nicolous Munisi  
**Status:** Draft for development  

SmartNekam ni mobile-first student platform inayounganisha wanafunzi wa O-Level, A-Level, na University kupata notes, past papers, study groups, mentors, scholarships, competitions, na maombi ya vyuo katika app moja. PRD nzuri inapaswa kufafanua purpose, users, features, user stories, UX, scope, metrics, risks, na non-functional requirements. [figma](https://www.figma.com/resource-library/product-requirements-document/)

***

## 1. Product overview

### 1.1 Problem

Wanafunzi Tanzania wanatumia apps na WhatsApp groups nyingi tofauti kupata:

- Notes na past papers.
- Maswali ya masomo.
- Study partners na mentors.
- Scholarships na competitions.
- Taarifa za vyuo vikuu na maombi.
- Msaada wa career na internships.

Hakuna sehemu moja rahisi inayounganisha **masomo + community + future opportunities**.

### 1.2 Solution

SmartNekam itakuwa “Student Super App” yenye:

- Learning library: notes, past papers, courses, quizzes.
- Community: study groups, Q&A, mentors, chats.
- Opportunities: scholarships, competitions, university applications, internships.
- Retention system: daily challenges, streaks, XP, leaderboards, alerts.

### 1.3 Product vision

> Kila mwanafunzi wa Tanzania apate msaada wa masomo, rafiki wa kusoma, na fursa ya baadaye—kwa simu yake.

### 1.4 Success vision after 12 months

- 50,000+ registered students.
- 30% D30 retention.
- 20% ya watumiaji wanaofanya daily challenge kila siku.
- 1,000+ verified opportunities.
- 500+ active mentors.
- 10,000+ notes na past papers zilizopakiwa.

***

## 2. Target users

| Persona | Description | Main needs |
|---|---|---|
| **Form Four student** | Anaandaa CSEE | Past papers, notes, revision groups, daily quizzes |
| **Form Six student** | Anaandaa ACSEE na kuomba vyuo | Combination materials, university guidance, scholarships |
| **University student** | Anahitaji notes, internships, na mentorship | Course materials, career opportunities, side income kama mentor |
| **Parent** | Anafuatilia mtoto | Progress, deadlines, school communication |
| **Teacher/Tutor** | Anasambaza materials | Upload notes, assignments, quizzes, analytics |
| **School admin** | Anasimamia shule | Announcements, students, performance |

## 3. User roles and permissions

| Role | Permissions |
|---|---|
| Guest | Browse public content, opportunities, universities; cannot download/chat |
| Student | Learn, join groups, ask questions, take quizzes, track applications |
| Senior/Mentor | Answer questions, host sessions, mentor juniors, earn reputation |
| Teacher/Tutor | Upload content, create classes, assignments, quizzes, view analytics |
| School Admin | Manage school profile, students, teachers, announcements |
| Parent | View child’s progress, deadlines, attendance, payments |
| Moderator | Approve/reject content, handle reports, block scammers |
| Super Admin | Full system control, payments, analytics, configuration |

***

## 4. Core value loop

```text
Student joins SmartNekam
→ Chooses level, school, and subjects
→ Gets personalized notes, papers, and opportunities
→ Completes Daily Challenge
→ Earns XP and protects streak
→ Joins study group / asks a senior
→ Shares app with classmates
→ Finds scholarship or university opportunity
→ Returns daily to track deadlines and progress
```

***

## 5. Feature scope

### 5.1 MVP — Phase 1

| Feature | Priority |
|---|---|
| Phone OTP authentication | P0 |
| Student profile and level selection | P0 |
| O-Level, A-Level, University categories | P0 |
| Notes upload/download | P0 |
| Past papers library | P0 |
| Study groups | P0 |
| Q&A / Ask a Senior | P0 |
| Daily Challenge | P0 |
| Streaks and XP | P0 |
| Notifications | P0 |
| Search | P0 |
| Scholarship listing | P0 |
| Scholarship reminders | P0 |
| Admin content moderation | P0 |
| Referral links | P1 |

### 5.2 Phase 2

- Quizzes and mock exams.
- Flashcards.
- Leaderboards.
- Mentor profiles and bookings.
- Direct chat.
- Application tracker.
- University directory.
- Competitions hub.
- Referral rewards.

### 5.3 Phase 3

- Video courses.
- Live classes.
- Assignments.
- Offline mode.
- Payments and premium subscriptions.
- Internship board.
- Parent portal.
- School dashboard.

### 5.4 Phase 4

- AI Study Assistant.
- AI scholarship matcher.
- AI personal statement builder.
- Tutor marketplace.
- Certificates.
- Advanced analytics.

***

## 6. App navigation

```text
[ Home ]  [ Learn ]  [ + ]  [ Community ]  [ Opportunities ]  [ Profile ]
```

Bottom navigation inapaswa kuwa na items 3–5 kwa urahisi wa matumizi; vitu vya ziada viweke kwenye Profile au drawer. 

***

## 7. Full screen structure

```text
Splash Screen
└── Onboarding
    ├── Language selection
    ├── Role selection
    ├── Level selection
    ├── School / University selection
    ├── Subject selection
    ├── Notification permission
    └── Referral code

Authentication
├── Welcome
├── Sign up with phone
├── OTP verification
├── Google sign-in
├── Login
├── Forgot password
└── Complete profile

HOME
├── Greeting & streak
├── Continue learning
├── Daily Challenge
├── Today’s tasks
├── Exam countdown
├── Deadlines
├── Recommended notes
├── Trending questions
├── Recommended opportunities
├── School announcements
├── Live sessions
└── Notifications preview

LEARN
├── Search
├── My Subjects
├── Notes
│   ├── Browse
│   ├── My uploads
│   ├── Saved
│   ├── Downloaded
│   └── Note viewer
├── Past Papers
│   ├── NECTA
│   ├── Mock exams
│   ├── University papers
│   ├── Marking schemes
│   └── Paper viewer
├── Courses
│   ├── Free
│   ├── Premium
│   ├── Video lessons
│   ├── Lesson player
│   └── Progress
├── Quizzes
│   ├── Daily quiz
│   ├── Subject quiz
│   ├── Mock exam
│   ├── Results
│   └── Explanations
├── Flashcards
│   ├── My decks
│   ├── Public decks
│   └── Revision mode
├── Study Planner
│   ├── Timetable
│   ├── Revision plan
│   ├── Reminders
│   └── Exam countdown
└── AI Study Assistant
    ├── Explain topic
    ├── Summarize notes
    ├── Generate quiz
    └── Answer doubts

CREATE (+)
├── Upload note
├── Upload past paper
├── Create study group
├── Ask question
├── Create quiz
├── Create flashcards
├── Create event
├── Create assignment
├── Post opportunity
└── Go live

COMMUNITY
├── Study Groups
│   ├── My groups
│   ├── Discover
│   ├── Group feed
│   ├── Group chat
│   ├── Files
│   ├── Assignments
│   ├── Polls
│   └── Members
├── Ask & Answer
│   ├── Ask question
│   ├── Question feed
│   ├── Question details
│   ├── Answers
│   ├── Best answer
│   └── Ask a Senior
├── Mentors
│   ├── Find mentor
│   ├── Mentor profile
│   ├── Book session
│   ├── Chat
│   └── Reviews
├── Chats
│   ├── Direct messages
│   ├── Group chats
│   └── Announcements
├── Live Rooms
│   ├── Join session
│   ├── Host session
│   └── Scheduled sessions
├── Events
│   ├── Seminars
│   ├── Tuition
│   ├── Career talks
│   ├── Competitions
│   └── Event details
└── Leaderboards
    ├── Students
    ├── Schools
    ├── Contributors
    └── Weekly challenge

OPPORTUNITIES
├── For Me
│   ├── Matched scholarships
│   ├── Matched competitions
│   ├── University deadlines
│   ├── Internships
│   └── Saved items
├── Scholarships
│   ├── Local
│   ├── International
│   ├── Government
│   ├── NGO / Private
│   ├── Fully funded
│   ├── Partial funding
│   └── Details
├── Competitions
│   ├── STEM
│   ├── Essays
│   ├── Debate
│   ├── Coding
│   ├── Innovation
│   ├── Arts & Sports
│   └── Details
├── University Applications
│   ├── Universities
│   ├── Programmes
│   ├── Entry requirements
│   ├── Deadlines
│   ├── Compare
│   ├── Checklist
│   └── Application tracker
├── Loans & Funding
│   ├── HESLB guide
│   ├── Eligibility checker
│   ├── Documents
│   ├── Dates
│   └── Status reminders
├── Jobs & Internships
│   ├── Internships
│   ├── Part-time jobs
│   ├── Graduate programmes
│   ├── Volunteering
│   └── Career fairs
└── Alerts
    ├── New matches
    ├── Deadline reminders
    └── Application status

PROFILE
├── My profile
├── Edit profile
├── Academic details
├── Progress dashboard
├── Streaks
├── XP & level
├── Badges
├── Certificates
├── Saved items
├── My uploads
├── My questions & answers
├── My applications
├── Wallet
├── Subscriptions
├── Referrals
├── Notifications
├── Privacy & security
├── Help & support
└── Logout
```

***

## 8. User stories and acceptance criteria

### 8.1 Authentication

**US-01: Student signs up**  
As a student, I want to create an account using my phone number so that I can access learning materials.

**Acceptance criteria**
- Given a new user, when they enter a valid Tanzanian phone number, then they receive an OTP.
- Given a correct OTP, when verified, then an account is created.
- Given an incorrect OTP after 5 attempts, then the account is temporarily locked for 15 minutes.

### 8.2 Profile setup

**US-02: Student selects academic level**  
As a student, I want to choose O-Level, A-Level, or University so that SmartNekam can show relevant content.

**Acceptance criteria**
- Student must select one level.
- O-Level requires form/year and subjects.
- A-Level requires combination and subjects.
- University requires institution, course, and year.
- Content feed updates immediately after selection.

### 8.3 Notes

**US-03: Student uploads notes**  
As a student, I want to upload notes so that classmates can benefit.

**Acceptance criteria**
- Supported formats: PDF, DOCX, PPTX, JPG, PNG.
- Maximum file size: 25 MB for MVP.
- Upload requires title, subject, level, and description.
- Uploaded content enters “Pending Review” state.
- Approved content becomes searchable.

**US-04: Student downloads notes**  
As a student, I want to download notes for offline revision.

**Acceptance criteria**
- Student can download approved PDFs.
- Downloaded files appear in “Offline” section.
- Download count increases by one per unique user.
- User can save content without downloading.

### 8.4 Past papers

**US-05: Student finds past paper**  
As a Form Four student, I want to search NECTA past papers by subject and year so that I can revise efficiently.

**Acceptance criteria**
- Search supports subject, year, exam type, and level.
- Results show title, year, subject, uploader, and downloads.
- User can open PDF in in-app viewer.
- User can download if permitted.

### 8.5 Study groups

**US-06: Student creates study group**  
As a student, I want to create a Physics revision group so that I can study with classmates.

**Acceptance criteria**
- Group requires name, level, subject, and privacy setting.
- Public groups appear in Discover.
- Private groups require invite link or code.
- Creator becomes group admin.
- Group supports posts, files, comments, and members list.

### 8.6 Q&A

**US-07: Student asks question**  
As a student, I want to ask a subject question so that seniors or teachers can help me.

**Acceptance criteria**
- Question requires subject and body text.
- User may attach up to 3 images or 1 PDF.
- Question appears in subject feed.
- Other users can answer, upvote, and comment.
- Asker can mark one Best Answer.
- Best Answer author receives XP.

### 8.7 Daily Challenge

**US-08: Student completes daily challenge**  
As a student, I want a short daily quiz so that I can maintain a study habit.

**Acceptance criteria**
- Daily Challenge contains 5 questions.
- Maximum duration: 5 minutes.
- User receives XP immediately after completion.
- Streak increases after successful completion.
- User can view correct answers and explanations.
- One Daily Challenge per user per day.

### 8.8 Streaks

**US-09: Student protects streak**  
As a student, I want to see my study streak so that I stay motivated.

**Acceptance criteria**
- Streak increases after completing any qualifying learning activity.
- Missing a day resets streak unless Streak Freeze is used.
- Streak Freeze can be earned with coins or XP.
- Streak is visible on Home and Profile.

### 8.9 Scholarships

**US-10: Student discovers scholarship**  
As an A-Level student, I want to find scholarships matching my profile so that I can apply for funding.

**Acceptance criteria**
- Scholarship listing supports filters: level, field, funding type, deadline, location.
- Each scholarship shows sponsor, eligibility, deadline, documents, and source link.
- Student can save a scholarship.
- Student can set a deadline reminder.
- Unverified opportunities must display a warning.

### 8.10 Application tracker

**US-11: Student tracks application**  
As a student, I want to track scholarship and university applications so that I do not miss deadlines.

**Acceptance criteria**
- User can create an application from any opportunity.
- Tracker shows status: Not started, Preparing, Submitted, Interview, Accepted, Rejected.
- User can add checklist items and upload document references.
- App sends reminders before deadline.
- User can view all applications in one screen.

### 8.11 University applications

**US-12: Student explores universities**  
As a Form Six student, I want to compare universities and programmes so that I can choose where to apply.

**Acceptance criteria**
- University profile shows location, programmes, requirements, fees, contacts, and application dates.
- Student can compare up to 3 universities.
- Student can save programmes.
- Student can set application reminders.

### 8.12 Mentorship

**US-13: Student books mentor**  
As an O-Level student, I want to book a university mentor so that I can receive subject guidance.

**Acceptance criteria**
- Mentor profile shows subjects, bio, rating, price, and availability.
- Student can send booking request.
- Mentor can accept or reject.
- After acceptance, chat room opens.
- After session, student can leave a rating.

### 8.13 Moderation

**US-14: User reports content**  
As a user, I want to report scam or inappropriate content so that SmartNekam remains safe.

**Acceptance criteria**
- Every note, question, answer, group, and opportunity has Report button.
- Report requires reason.
- Reported content enters moderation queue.
- Moderator can approve, reject, or remove content.
- Repeat offenders can be suspended.

***

## 9. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Users can register using phone number and OTP | P0 |
| FR-02 | Users can select role and academic level | P0 |
| FR-03 | Students can browse notes by level, subject, and school | P0 |
| FR-04 | Students can upload notes and past papers | P0 |
| FR-05 | Admin can approve or reject uploaded content | P0 |
| FR-06 | Students can create and join study groups | P0 |
| FR-07 | Students can ask and answer subject questions | P0 |
| FR-08 | Students can complete one Daily Challenge per day | P0 |
| FR-09 | System awards XP and updates streaks | P0 |
| FR-10 | Students can save and download content | P0 |
| FR-11 | Students can receive push notifications | P0 |
| FR-12 | Students can search content and groups | P0 |
| FR-13 | Students can browse scholarships and competitions | P0 |
| FR-14 | Students can set opportunity reminders | P0 |
| FR-15 | Students can track applications | P1 |
| FR-16 | Students can browse universities and programmes | P1 |
| FR-17 | Students can book mentors | P1 |
| FR-18 | Users can earn referral rewards | P1 |
| FR-19 | Users can report inappropriate content | P0 |
| FR-20 | Admin can manage users, content, and opportunities | P0 |

***

## 10. Database schema

### 10.1 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(30) NOT NULL DEFAULT 'student',
  level VARCHAR(30), -- O_LEVEL, A_LEVEL, UNIVERSITY
  form_or_year VARCHAR(20),
  school_id UUID,
  university_id UUID,
  combination VARCHAR(20),
  course VARCHAR(120),
  region VARCHAR(80),
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.2 subjects

```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  level VARCHAR(30) NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.3 notes

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES users(id),
  subject_id UUID REFERENCES subjects(id),
  level VARCHAR(30),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20),
  file_size_mb NUMERIC(6,2),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'pending',
  downloads INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.4 past_papers

```sql
CREATE TABLE past_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES users(id),
  subject_id UUID REFERENCES subjects(id),
  level VARCHAR(30),
  exam_type VARCHAR(50), -- NECTA, Mock, University
  year INTEGER,
  title VARCHAR(200),
  file_url TEXT NOT NULL,
  marking_scheme_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.5 study_groups

```sql
CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  level VARCHAR(30),
  subject_id UUID REFERENCES subjects(id),
  school_id UUID,
  creator_id UUID REFERENCES users(id),
  privacy VARCHAR(20) DEFAULT 'public',
  invite_code VARCHAR(20) UNIQUE,
  member_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.6 group_members

```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);
```

### 10.7 questions

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  subject_id UUID REFERENCES subjects(id),
  title VARCHAR(200),
  body TEXT NOT NULL,
  attachments TEXT[],
  upvotes INTEGER DEFAULT 0,
  best_answer_id UUID,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.8 answers

```sql
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id),
  user_id UUID REFERENCES users(id),
  body TEXT NOT NULL,
  attachments TEXT[],
  upvotes INTEGER DEFAULT 0,
  is_best_answer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.9 quizzes

```sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200),
  subject_id UUID REFERENCES subjects(id),
  level VARCHAR(30),
  type VARCHAR(30), -- daily, subject, mock
  duration_minutes INTEGER,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.10 quiz_questions

```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option VARCHAR(10),
  explanation TEXT,
  marks INTEGER DEFAULT 1
);
```

### 10.11 opportunities

```sql
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(30), -- scholarship, competition, internship, university
  title VARCHAR(200) NOT NULL,
  sponsor VARCHAR(150),
  level VARCHAR(30),
  field VARCHAR(100),
  funding_type VARCHAR(50),
  amount TEXT,
  country VARCHAR(80),
  deadline DATE,
  eligibility TEXT,
  documents TEXT[],
  source_url TEXT,
  application_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.12 applications

```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  opportunity_id UUID REFERENCES opportunities(id),
  status VARCHAR(30) DEFAULT 'not_started',
  deadline DATE,
  checklist JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.13 mentors

```sql
CREATE TABLE mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  bio TEXT,
  subjects TEXT[],
  hourly_rate NUMERIC(10,2),
  rating NUMERIC(3,2) DEFAULT 0,
  availability JSONB,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10.14 notifications

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(150),
  body TEXT,
  type VARCHAR(40),
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

***

## 11. API endpoints

Authentication uses JWT. All endpoints begin with `/api/v1`.

### 11.1 Auth

```http
POST /api/v1/auth/request-otp
POST /api/v1/auth/verify-otp
POST /api/v1/auth/google
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

### 11.2 Users

```http
GET    /api/v1/users/me
PATCH  /api/v1/users/me
POST   /api/v1/users/me/subjects
GET    /api/v1/users/me/progress
GET    /api/v1/users/me/streak
GET    /api/v1/users/me/referrals
```

### 11.3 Notes and papers

```http
GET    /api/v1/notes
GET    /api/v1/notes/:id
POST   /api/v1/notes
PATCH  /api/v1/notes/:id
DELETE /api/v1/notes/:id
POST   /api/v1/notes/:id/download
POST   /api/v1/notes/:id/save

GET    /api/v1/past-papers
GET    /api/v1/past-papers/:id
POST   /api/v1/past-papers
POST   /api/v1/past-papers/:id/download
```

### 11.4 Groups

```http
GET    /api/v1/groups
GET    /api/v1/groups/:id
POST   /api/v1/groups
POST   /api/v1/groups/:id/join
POST   /api/v1/groups/:id/leave
GET    /api/v1/groups/:id/posts
POST   /api/v1/groups/:id/posts
POST   /api/v1/groups/:id/files
```

### 11.5 Q&A

```http
GET    /api/v1/questions
GET    /api/v1/questions/:id
POST   /api/v1/questions
POST   /api/v1/questions/:id/answers
POST   /api/v1/answers/:id/upvote
POST   /api/v1/questions/:id/best-answer
```

### 11.6 Quizzes

```http
GET    /api/v1/quizzes/daily
GET    /api/v1/quizzes
GET    /api/v1/quizzes/:id
POST   /api/v1/quizzes/:id/start
POST   /api/v1/quizzes/:id/submit
GET    /api/v1/quizzes/:id/result
```

### 11.7 Opportunities

```http
GET    /api/v1/opportunities
GET    /api/v1/opportunities/:id
POST   /api/v1/opportunities
PATCH  /api/v1/opportunities/:id
POST   /api/v1/opportunities/:id/save
POST   /api/v1/opportunities/:id/remind
GET    /api/v1/opportunities/for-me
```

### 11.8 Applications

```http
GET    /api/v1/applications
POST   /api/v1/applications
GET    /api/v1/applications/:id
PATCH  /api/v1/applications/:id
POST   /api/v1/applications/:id/checklist
POST   /api/v1/applications/:id/documents
```

### 11.9 Mentors

```http
GET    /api/v1/mentors
GET    /api/v1/mentors/:id
POST   /api/v1/mentors
POST   /api/v1/mentors/:id/book
GET    /api/v1/mentor-sessions
POST   /api/v1/mentor-sessions/:id/review
```

### 11.10 Admin

```http
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/users
PATCH  /api/v1/admin/users/:id/status
GET    /api/v1/admin/content/pending
PATCH  /api/v1/admin/content/:id/approve
PATCH  /api/v1/admin/content/:id/reject
POST   /api/v1/admin/opportunities
POST   /api/v1/admin/notifications
```

***

## 12. Screen-by-screen requirements

| Screen | Purpose | Key elements |
|---|---|---|
| Splash | Brand entry | Logo, loading state |
| Onboarding | Capture user context | Role, level, school, subjects |
| OTP | Verify phone | 6-digit input, resend timer |
| Home | Daily engagement | Streak, challenge, deadlines, feed |
| Learn | Access content | Search, subjects, notes, papers |
| Note Detail | View content | PDF viewer, download, save, rating |
| Past Paper Detail | Exam revision | Year, subject, paper, marking scheme |
| Quiz | Practice | Timer, questions, progress bar |
| Quiz Result | Feedback | Score, XP, explanations |
| Group Feed | Community learning | Posts, files, comments |
| Ask Question | Get help | Subject, body, attachments |
| Question Detail | Peer support | Answers, upvotes, best answer |
| Opportunities | Discover future paths | Filters, cards, deadlines |
| Scholarship Detail | Apply confidently | Eligibility, documents, deadline |
| Application Tracker | Stay organized | Status, checklist, reminders |
| University Detail | Choose school | Programmes, requirements, deadlines |
| Mentor Profile | Get guidance | Bio, subjects, price, booking |
| Profile | Personal identity | Progress, badges, wallet, settings |
| Admin Panel | Manage platform | Users, moderation, analytics |

***

## 13. Figma screen list

Design the following screens in Figma:

1. Splash  
2. Onboarding — Welcome  
3. Onboarding — Language  
4. Onboarding — Role  
5. Onboarding — Level  
6. Onboarding — School/University  
7. Onboarding — Subjects  
8. Phone Number  
9. OTP Verification  
10. Complete Profile  
11. Home — Student  
12. Home — Empty State  
13. Daily Challenge  
14. Daily Challenge Result  
15. Learn — Home  
16. Subject Detail  
17. Notes List  
18. Note Detail  
19. PDF Viewer  
20. Past Papers List  
21. Past Paper Detail  
22. Quiz List  
23. Quiz Playing  
24. Quiz Result  
25. Flashcards  
26. Study Planner  
27. Create Menu  
28. Upload Note  
29. Upload Past Paper  
30. Create Group  
31. Group Feed  
32. Group Chat  
33. Ask Question  
34. Question Feed  
35. Question Detail  
36. Mentor List  
37. Mentor Profile  
38. Booking Screen  
39. Chat List  
40. Chat Conversation  
41. Opportunities Home  
42. Scholarships List  
43. Scholarship Detail  
44. Competitions List  
45. Competition Detail  
46. University List  
47. University Detail  
48. University Comparison  
49. Application Tracker  
50. Application Detail  
51. Profile  
52. Edit Profile  
53. Progress Dashboard  
54. Badges & Achievements  
55. Wallet  
56. Referrals  
57. Notifications  
58. Settings  
59. Report Content  
60. Admin Dashboard  
61. Admin Content Moderation  
62. Admin Opportunity Management  

***

## 14. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | App opens in under 3 seconds on mid-range Android |
| API response | 95% of requests respond in under 500 ms |
| Offline | Downloaded notes and quizzes available offline |
| Data efficiency | Low-data mode and compressed previews |
| Security | Encrypted passwords, JWT auth, secure file URLs |
| Privacy | User phone numbers and documents protected |
| Availability | 99.5% uptime target |
| Scalability | Support 100,000+ users |
| Accessibility | Large text, high contrast, clear labels |
| Localization | Swahili and English |
| Moderation | All user uploads reviewed before public visibility |

***

## 15. Integrations

| Integration | Purpose |
|---|---|
| Firebase Cloud Messaging | Push notifications |
| Firebase Analytics / PostHog | User behavior and retention |
| Cloud storage | Notes, PDFs, videos |
| SMS/OTP provider | Phone verification |
| M-Pesa / Tigo Pesa / Airtel Money | Payments in later phases |
| Google Sign-In | Alternative authentication |
| University websites | Official opportunity links |
| HESLB / TCU / Ministry sources | Verified education opportunity references |

***

## 16. Release plan

| Milestone | Deliverable |
|---|---|
| Week 1–2 | Figma designs, database schema, API contract |
| Week 3–4 | Auth, onboarding, profile, Home |
| Week 5–6 | Notes, past papers, search, uploads |
| Week 7–8 | Groups, Q&A, notifications |
| Week 9–10 | Daily Challenge, streaks, XP, referrals |
| Week 11–12 | Opportunities, scholarships, reminders, admin panel |
| Week 13 | Beta launch to 500 students |
| Week 14–16 | Feedback, bug fixes, public launch |

***

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Copyrighted notes uploaded | Require original upload or permission; moderation queue |
| Scam scholarships | Verified badge, official source link, report button |
| Low retention | Daily Challenge, streaks, groups, personalized alerts |
| High data usage | Low-data mode, compressed files, offline downloads |
| Spam and abuse | Rate limits, reporting, moderators, account suspension |
| Payment complexity | Defer payments until after user growth |
| Cold-start content | Team uploads seed content before launch |

***

## 18. Launch metrics

| Metric | Target |
|---|---|
| Sign-up completion rate | 70%+ |
| D1 retention | 40%+ |
| D7 retention | 25%+ |
| D30 retention | 15–20%+ |
| Daily Challenge completion | 20%+ of DAU |
| Referral-driven signups | 30%+ |
| Scholarship saves per user | 2+ per month |
| Content uploads | 10% of active users monthly |

***

## 19. Out of scope for MVP

- Full payment system.
- Live video classes.
- AI assistant.
- Parent portal.
- School ERP integrations.
- Job board.
- Certificate generation.
- Advanced AI scholarship matching.

***

## 20. Open questions

1. Je, SmartNekam itaanza na Android tu au Android na iOS pamoja?
2. Je, notes za premium zitakuwa na malipo mapema?
3. Je, mentors watalipwa kwa kila session au kwa subscription?
4. Je, shule zitakuwa na accounts rasmi katika MVP?
5. Je, AI assistant itaanza Phase 2 au Phase 4?

PRD hii inatoa developer mwelekeo kamili wa kuanza: database schema, API endpoints, user stories, screens, roadmap, na metrics. PRD za modern apps huwa na overview, personas, user stories, features, UX flows, release criteria, risks, na success metrics. [figma](https://www.figma.com/resource-library/product-requirements-document/)