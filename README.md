# 📚 SummarAIze: AI-Powered Research Paper Summarization & Management

### 🔗 Website Link: [**SummarAIze**](https://summaraize-liart.vercel.app/)

## 👥 Team

- **Minhyeok Im** (114181150)
- **Semin Bae** (114730530)
- **Yoon Seok Yang** (Instructor)

## 🚀 Introduction

SummarAIze is an AI-powered platform that helps students and researchers efficiently read, summarize, and manage academic papers. By generating concise summaries with page references, automatically extracting citations in various academic styles, and offering a personal library with paper organization and recommendations, we make academic research more accessible and manageable. Our goal is to transform the research process, saving time and reducing the barriers to effective academic reading.

## 🎯 Target Users

- **Undergraduate Students**: New to academic papers, with limited time to process complex research
- **Graduate Students & Researchers**: Need to quickly extract insights from numerous papers
- **Professors & Academic Staff**: Require efficient methods to stay updated with new research
- **Non-Native Language Users**: Find it challenging to understand papers in languages other than their own

## 🔥 The Problem

### ⏳ Struggling with Time

Students often don't have the time to read lengthy research papers in full. While essential for deeper learning, papers can be too long and dense to process efficiently.

### 🤯 Difficult Terminology & Complex Content

Many research papers are filled with technical jargon and require extensive background knowledge, making them hard to understand—especially for beginners or researchers from other fields.

### 🔍 Inefficient Search & Recommendation

Finding the right papers can be a challenge. Existing search systems are inefficient, leaving students overwhelmed with too many results and no clear direction.

## 🎯 Our Solution

### ✨ **AI-Powered Summarization**

- Upload a **PDF**, and our AI will generate a **concise summary** with page references to help you grasp key points quickly.
- The system analyzes the document structure to identify key sections.
- Works with academic PDFs up to ~30 pages in length.

### 📝 **Citation Management**

- Automatically extract citation information from papers (title, authors, year, journal).
- Generate citations in multiple formats (MLA, APA).
- Copy citations to clipboard with a single click.

### 🔎 **Smart Paper Recommendation**

- Get **personalized paper recommendations** based on your uploaded documents.
- AI analyzes paper content to suggest related research.
- View recommendation rationales to understand why papers are suggested.

### 📂 **Personal Library Management**

- Save and organize summarized papers in your **personal library**.
- Search your library by title and author.
- View your research history in a well-organized interface.

### 🌐 **Multi-Language Support**

- Select your preferred language for summaries.
- Makes research more accessible for non-native language users.

## 🛠️ Tech Stack

### Frontend

- **React.js (v19.0.0)**: For building the user interface
- **React Router (v7.4.1)**: For client-side routing
- **Tailwind CSS (v3.4.17)**: For styling and responsive design
- **Google PDF**: For rendering PDF documents
- **React Markdown (v10.1.0)**: For rendering summaries

### Backend

- **Node.js (v18.x)**: Server-side JavaScript runtime
- **AWS Lambda**: For serverless execution of PDF processing
- **AWS WebSocket API**: For real-time status updates
- **socket.io(4.7.2)**: For the web socket connection with the client

### AI and Data Processing

- **OpenAI API (GPT-4o)**: For AI-powered summarization
- **PDF-Parse**: For extracting text from PDFs

### Authentication & Security

- **Google OAuth**: For secure user authentication
- **JWT (JSON Web Tokens)**: For secure session management

### Database and Storage

- **AWS DynamoDB**: For storing user data and paper metadata
- **AWS S3**: For storage of uploaded documents and summaries

### Code Convention

- **JavaScript/React(Frontend)**: Google JavaScript Style Guide
- **Node.js (Backend):** Airbnb JavaScript Style Guide Reactspecific conventions
- ESLint for static code analysis JSDoc for code documentation Prettier for code
formatting
- Camel case for variables and functions Pascal case for component names

## 🚧 Development Timeline

- [Software Milestone](/summeraize/Document/Milestone.md)

| Milestone | Date | Status | Features |
| --- | --- | --- | --- |
| Initial Design | March 21, 2025 | ✅ | Requirements specification, problem definition |
| Software Design | April 14, 2025 | ✅ | Architecture design, API specifications, deployment planning |
| Milestone 1 | April 23, 2025 | ✅ | Database implementation, API server setup, basic frontend |
| Milestone 2 | April 30, 2025 | ✅ | Complete API server, OAuth integration, user profile management |
| Milestone 3 | May 12, 2025 | ✅ | Complete frontend, S3 integration, file operations |
| Beta Release | May 19, 2025 | ✅ | Deployed application, AWS services configuration |
| Final Presentation | May 28, 2025 | ✅ | Project demonstration and presentation |

## 💡 Key Features

### User Authentication and Management

- Create accounts and log in securely through Google OAuth
- Manage account settings and profile information
- Secure password management and profile image customization

### Document Upload and Processing

- Upload PDFs via drag-and-drop or file explorer
- Intelligent extraction of document text and structure
- Real-time processing status updates

### AI-Powered Summarization

- Generate concise summaries with key information
- Include page references for easy verification
- Support multiple languages for international users

## 🖥️ Platform Support

- Web application accessible via modern browsers (Chrome, Firefox)
- Responsive design with focus on desktop experience
- No native mobile application (future consideration)

## 🔑 Main Role

### MINHYEOK IM

- Database (DynamoDB) Setup & Implementation
- API server (AWS Lambda) Setup & implementation
- S3 Storage Setup & integration
- Client-Server interaction integration
- Google OAuth integration (backend)
- Complete backend deployment

### SEMIN BAE

- Frontend foundation & implementation
- Google OAuth integration (frontend)
- Client-Server connection integration
- File Upload & Download implementation
- Complete frontend deployment

## 🔗 Related Links

- [Final Presenatation Document](/summeraize/Document/Final_Presentation_Document.pdf)
- [Functional & Non-Functional Requirements](/summeraize/Document/Project_Requirement.md)
- [MileStone Documentation](/summeraize/Document/Milestone.md)
- [Use Cases](/summeraize/Document/Use_cases.md)
- [UI Design (Figma)](https://www.figma.com/design/Z75XG7AuxpYYATCS8o7In2/SummarAIze?node-id=0-1&p=f&t=zk77b4eVKRgLqtIL-0)
- [Data Design](/summeraize/Document/updated_api_design.md)
- [Gentt Chart](/summeraize/Document/gentt.png)
- [Bug Report](https://docs.google.com/document/d/1YD1cGAYec5Am-RQ4v8fjw25pL-mVJ49lrDPOW2bCgCY/edit?tab=t.7j99t12qhzoy)

---

*SummarAIze - Smart Summary, Smarter Research*
