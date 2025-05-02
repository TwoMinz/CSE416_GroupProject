# SummarAIze Project Milestones

**Minhyeok Im, Semin Bae**  
**CSE416 / Spring 2025**  
**Last Modified: May/02/2025**

## Overview

This document tracks progress toward the four milestones of the SummarAIze project, which is an AI-powered platform that helps students and researchers efficiently read, summarize, and manage academic papers.

## Team Members

- Minhyeok Im (114181150)
- Semin Bae (114730530)

## Project Repository

GitHub: SummarAIze Repository - Update with your actual repository link

## Milestone 1 - Due: April 23, 2025

### Milestone 1 Requirements Checklist

#### Database Implementation (Minhyeok)
- [x] Set up DynamoDB tables
  - [x] Users table
  - [x] Papers table
  - [x] User Archives
  - [x] Connections table (for WebSockets)
- [x] Create basic database CRUD operations
- [x] Implement database connection utilities

#### API Server Initial Setup (Minhyeok)
- [x] Set up Node.js project with necessary dependencies
- [x] Configure AWS SDK for local development
- [x] Implement basic error handling middleware
- [ ] Set up authentication middleware (Milestone 3)
- [x] Configure CORS settings
- [x] Set up logging

#### Frontend Foundation (Semin)
- [x] Create React project with necessary dependencies
- [x] Configure routing with React Router
- [x] Set up Tailwind CSS for styling
- [x] Create login page UI
  - [x] Login form
  - [ ] Error handling (Delayed to Milestone 3)
  - [ ] Redirection logic (Delayed to Milestone 3)
- [x] Create registration page UI
  - [x] Registration form
  - [x] Form validation
  - [ ] Success/error handling (Delayed to Milestone 3)
- [x] Implement home page with file upload UI
- [x] Create basic component structure

#### Authentication System Implementation (Semin)
- [x] Implement user registration functionality
- [x] Implement login functionality
- [x] Set up token-based authentication
- [x] Add token storage and management
- [x] Create authentication context
- [x] Add protected routes

#### Basic Server-Client Connection Testing (Semin)
- [x] Create test API endpoints
- [x] Implement API client service in React
- [x] Test connection between frontend and backend
- [x] Implement error handling for API calls
- [ ] Add loading states for API interactions (Delayed to Milestone 3)

#### Documentation
- [x] Update README.md with setup instructions
- [x] Document API endpoints
- [x] Add database schema documentation
- [x] Create bug tracking system

## Milestone 2 - Due: April 30, 2025

### Milestone 2 Requirements Checklist

#### Complete API Server Implementation (Minhyeok)
- [x] Complete API endpoints for user authentication
  - [x] Login endpoint
  - [x] Signup endpoint
  - [ ] Google OAuth integration endpoints (Delayed to Milestone 4)
  - [x] Logout endpoint
- [x] Complete API endpoints for paper management
  - [x] Upload request endpoint
  - [x] Upload confirmation endpoint
  - [x] Paper processing endpoint
- [x] Complete API endpoints for library management
  - [x] Load library endpoint
  - [x] Get paper details endpoint
  - [x] Get content URL endpoint
- [ ] Implement WebSocket connection for real-time updates (Delayed to Milestone 3)
  - [ ] Connect/disconnect handlers
  - [ ] Paper process status handler

#### User Profile Management (Minhyeok)
- [x] Implement user profile retrieval API
- [x] Implement profile update endpoints
  - [x] Change username
  - [x] Change password
  - [x] Change profile image

#### Client-API Server Integration (Semin)
- [x] Implement API client service in React
  - [x] Authentication service
  - [x] Paper upload service
  - [ ] WebSocket service (Delayed to Milestone 3)
  - [x] Library service
- [x] Connect frontend components to API
  - [x] Login/Signup forms
  - [x] Home page uploader
  - [ ] Library page (Delayed to Milestone 3)
  - [ ] Paper viewer (Delayed to Milestone 3)

#### Google OAuth Integration (Semin) - (Delayed to Milestone 4)
- [ ] Implement Google OAuth on frontend
- [ ] Connect OAuth flow to backend endpoints
- [ ] Test OAuth authentication flow

#### Testing
- [x] API endpoint unit tests
- [x] Authentication flow tests
- [x] Database operation tests
- [ ] WebSocket connection tests

#### Documentation
- [x] Update API documentation with all endpoints
- [x] Update project schedule
- [ ] Document OAuth integration process

## Milestone 3 - Due: May 12, 2025

### Milestone 3 Requirements Checklist

#### Complete Frontend Implementation (Semin)
- [ ] Finalize all UI components
  - [x] Home page
  - [x] Login/Signup pages
  - [ ] Paper view page
  - [ ] Library page
  - [ ] User settings page
- [ ] Implement responsive design for all screen sizes
- [ ] Add loading states and transitions
- [ ] Implement error handling and user feedback
- [ ] Create and style all modals and popups
- [ ] Implement theme styling consistency

#### Full API Server Integration (Minhyeok)
- [ ] Complete remaining API endpoints
- [ ] Optimize API responses
- [ ] Implement caching where appropriate
- [ ] Add rate limiting
- [ ] Complete error handling for all edge cases
- [ ] Finalize WebSocket functionality

#### S3 Storage Server Setup (Minhyeok)
- [ ] Configure S3 buckets
  - [ ] Paper uploads bucket
  - [ ] Summaries bucket
  - [ ] User profile images bucket
- [ ] Set up proper access policies
- [ ] Implement file versioning if needed
- [ ] Configure lifecycle rules
- [ ] Set up encryption

#### File Upload/Download Functionality (Semin)
- [ ] Implement drag-and-drop file upload
- [ ] Add file type validation
- [ ] Create upload progress indicators
- [ ] Implement resumable uploads for large files
- [ ] Add file download functionality
- [ ] Create PDF viewer component

#### Initial End-to-End Testing (Minhyeok)
- [ ] Create end-to-end test suite
- [ ] Test user registration flow
- [ ] Test paper upload and processing flow
- [ ] Test library management
- [ ] Test user profile updates
- [ ] Test edge cases and error handling

#### Documentation
- [ ] Update API documentation with final changes
- [ ] Document S3 configuration
- [ ] Create user documentation for platform features
- [ ] Update README with latest setup instructions

## Milestone 4 (Beta Release) - Due: May 19, 2025

### Milestone 4 Requirements Checklist

#### Web Application Deployment (Semin)
- [ ] Deploy frontend application via Vercel
- [ ] Configure build settings
- [ ] Set up environment variables
- [ ] Connect to GitHub repository
- [ ] Configure custom domain (if applicable)
- [ ] Test deployed application
  - [ ] Test on different browsers
  - [ ] Test on mobile devices
  - [ ] Performance testing

#### AWS Services Configuration (Minhyeok)
- [ ] Configure custom URL domain
- [ ] Upload server code
- [ ] Initiate AWS Lambda functions
  - [ ] Authentication functions
  - [ ] Paper processing functions
  - [ ] Library management functions
- [ ] Configure AWS API Gateway
- [ ] Set up WebSocket API endpoint
- [ ] Test all serverless functions

#### Final Integration (Both)
- [ ] Connect frontend to production backend
- [ ] Test all features in production environment
- [ ] Monitor for performance issues
- [ ] Implement any critical fixes

#### Beta Testing (Semin)
- [ ] Create test accounts
- [ ] Conduct user acceptance testing
- [ ] Collect and address feedback
- [ ] Fix critical bugs
- [ ] Document known issues

#### Documentation
- [ ] Create beta release notes
- [ ] Update README with production details
- [ ] Document deployment process
- [ ] Update bug tracking system
- [ ] Create user guide

#### Presentation Preparation
- [ ] Create presentation slides
- [ ] Prepare demo script
- [ ] Assign presentation roles
- [ ] Practice presentation
- [ ] Prepare for Q&A

Each team member should provide:
- List of tasks assigned and completed
- List of tasks in progress
- Percentage of completion for partial tasks
- Challenges encountered and solutions

#### Group Progress Update
- Overall progress assessment (on track, ahead, or behind)
- Team grade self-assessment with justification
- Adjustment plan for any schedule deviations
- Final feature set confirmation

## Final Project Presentation - Due: May 28, 2025

### Final Requirements Checklist

#### Final Testing and Bug Fixes
- [ ] Test case verification (Semin)
  - [ ] Create comprehensive test cases
  - [ ] Verify all features against requirements
  - [ ] Document test results
- [ ] Bug reporting and tracking (Minhyeok)
  - [ ] Organize reported bugs by severity
  - [ ] Fix critical bugs
  - [ ] Document known issues
- [ ] Regression testing (Semin)
  - [ ] Ensure new fixes don't break existing features
  - [ ] Test all user flows
- [ ] User acceptance testing (Minhyeok)
  - [ ] Get feedback from test users
  - [ ] Implement critical feedback

#### Final Documentation
- [ ] Complete API documentation
- [ ] User manual
- [ ] Installation guide
- [ ] Developer documentation
- [ ] Final report with:
  - [ ] Project overview
  - [ ] Technical architecture
  - [ ] Challenges and solutions
  - [ ] Future improvements

#### Final Presentation
- [ ] Create presentation slides (Semin)
  - [ ] Project overview
  - [ ] Key features demonstration
  - [ ] Technical highlights
  - [ ] Challenges and solutions
- [ ] Demo script preparation (Minhyeok)
  - [ ] Plan demo flow
  - [ ] Prepare backup demos in case of issues
  - [ ] Create talking points
- [ ] Live demonstration (Semin & Minhyeok)
  - [ ] Practice run-through
  - [ ] Prepare for common questions
  - [ ] Assign presentation roles
- [ ] Q&A preparation (Minhyeok)
  - [ ] Anticipate questions
  - [ ] Prepare responses

#### Final Submission Materials
- [ ] Source code (with documentation)
- [ ] Setup instructions
- [ ] User documentation
- [ ] Access information for deployed application
- [ ] Final presentation slides
- [ ] Project report
