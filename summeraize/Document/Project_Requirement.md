# SummarAIze - Requirements

## 1. Functional Requirements

### User Authentication and Management
- Users shall be able to create accounts and log in securely through Google OAuth.
- Users shall be able to view and manage their account settings.
- Users shall be able to log out of the application.
- Users shall be able to change user’s profile image.
- Users shall be able to change account passwords.

### Document Upload and Processing
- Users shall be able to upload PDF files through drag and drop.
- Users shall be able to upload PDF files through the system file explorer.
- The system shall process and extract text content from uploaded PDFs.
- The system shall analyze the document structure to identify key sections.

### AI-Powered Summarization
- The system shall generate concise summaries of uploaded research papers using OpenAI API.
- The system shall attempt to identify key information with page references when possible.
- The system shall support the user’s preference language.

### Citation Management
- The system shall extract basic citation information from papers automatically if it assesses from PDF meta datas(title, authors, year, journal).
- The system shall generate citations in various common formats.

### Research Recommendation
- The system shall suggest related papers based on AI-powered matching systems.

### Library Management
- Users shall be able to save summarized papers to their library.
- The system shall display a simple list of previously processed papers.

### User Interface
- The interface shall be functional on desktop browsers.
- The interface shall display paper information and summary in a readable format.
- The interface shall have a consistent and user-friendly design.

## 2. Non-functional Requirements

### Performance Requirements
- The system shall process and summarize a typical research paper (20-30 pages) within 2-3 minutes, as AI processing may take time.
- The web application shall load initial content within 5 seconds on standard broadband connections.
- The system shall support concurrent processing of up to 10-15 papers without significant performance degradation, appropriate for a university project scale.
- Search functionality within the user's library shall return results within 3 seconds.

### Security Requirements
- All user data shall be encrypted both in transit and at rest.
- The system shall implement OAuth 2.0 for secure authentication.
- The system shall maintain separation between user accounts, ensuring users cannot access others' libraries.
- The system shall automatically log users out after 30 minutes of inactivity.
- The system shall implement rate limiting to prevent abuse of the API.

### Reliability Requirements
- The system shall function reliably during demonstration periods.
- The system shall implement basic error handling for common failure scenarios.
- If summarization fails, the system shall provide basic error messages.
- The system shall maintain user data throughout the course project.

### Usability Requirements
- New users shall be able to upload and summarize their first paper within 5 minutes without requiring documentation.
- The interface shall be intuitive for typical college students.
- The system shall function correctly on Chrome and Firefox browsers.
- The system shall provide basic tooltips for the main features.

### Scalability Requirements
- The database shall support efficient storage and retrieval of at least 1,000 processed papers, suitable for demonstration purposes.
- The system architecture shall be designed with future scalability in mind, even if not immediately implemented.
