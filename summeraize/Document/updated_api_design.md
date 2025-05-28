# SummarAIze API Design Document - Updated

## Authentication APIs

| Name | HTTP Method | URL | Input | Output | Additional Notes |
|------|-------------|-----|-------|--------|------------------|
| **Sign Up** | POST | `/api/auth/signup` | ```json {   "email": "string",   "password": "string",   "username": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | Creates new account with default profile image |
| **Login** | POST | `/api/auth/login` | ```json {   "email": "string",   "password": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User,   "accessToken": "string",   "refreshToken": "string",   "expiresIn": number }``` | Returns JWT tokens for session management |
| **Google OAuth** | GET | `/api/auth/google` | Query params from Google OAuth | Redirects to frontend with tokens | Handles Google OAuth callback |
| **Refresh Token** | POST | `/api/auth/refresh` | ```json {   "refreshToken": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User,   "accessToken": "string",   "expiresIn": number }``` | Generates new access token |
| **Change Username** | POST | `/api/auth/modify/username` | ```json {   "userId": "string",   "newUserId": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | Requires Authorization header |
| **Change Password** | POST | `/api/auth/modify/password` | ```json {   "userId": "string",   "newPassword": "string",   "currentPassword": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | currentPassword optional for OAuth users |
| **Change Language** | POST | `/api/auth/modify/language` | ```json {   "userId": "string",   "languageCode": number }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | 1=English, 2=Korean, 3=Spanish, 4=French |
| **Change Profile Image** | POST | `/api/auth/modify/profileImage` | ```json {   "userId": "string",   "imageUrl": "string" }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | Updates profile image URL in database |
| **Logout** | POST | `/api/auth/logout` | ```json {   "user": User }``` | ```json {   "success": boolean,   "message": "string" }``` | Cleans up WebSocket connections |

## Profile Management APIs

| Name | HTTP Method | URL | Input | Output | Additional Notes |
|------|-------------|-----|-------|--------|------------------|
| **Request Profile Image Upload** | POST | `/api/profile/upload` | ```json {   "userId": "string",   "fileName": "string",   "fileType": "string",   "fileSize": number }``` | ```json {   "success": boolean,   "uploadUrl": "string",   "fileKey": "string",   "directUploadConfig": Object }``` | Generates S3 presigned URL for image upload |
| **Confirm Profile Image Upload** | POST | `/api/profile/confirm` | ```json {   "userId": "string",   "fileKey": "string",   "uploadSuccess": boolean }``` | ```json {   "success": boolean,   "message": "string",   "user": User }``` | Updates user profile with new image URL |

## Paper Processing APIs

| Name | HTTP Method | URL | Input | Output | Additional Notes |
|------|-------------|-----|-------|--------|------------------|
| **Request File Upload** | POST | `/api/upload/request` | ```json {   "fileName": "string",   "fileType": "string",   "fileSize": number }``` | ```json {   "success": boolean,   "uploadUrl": "string",   "fileKey": "string",   "paperId": string,   "expiresIn": number,   "directUploadConfig": {     "url": "string",     "fields": Object   } }``` | Creates paper record and S3 presigned URL |
| **Confirm Upload** | POST | `/api/upload/confirm` | ```json {   "paperId": "string",   "fileKey": "string",   "uploadSuccess": boolean,   "fileName": "string" }``` | ```json {   "success": boolean,   "message": "string",   "paperId": "string",   "status": "string" }``` | Triggers paper processing if upload successful |
| **Get Content URLs** | GET | `/api/papers/{paperId}/contentUrl` | Path parameter: paperId | ```json {   "success": boolean,   "pdfUrl": "string",   "summaryUrl": "string",   "expiresIn": number }``` | Returns presigned URLs for PDF and summary |
| **Get Paper Detail** | GET | `/api/papers/{paperId}/detail` | Path parameter: paperId | ```json {   "paperId": "string",   "title": "string",   "summary": "string",   "keyPoints": KeyPoint[],   "citation": Citation,   "lastUpdated": "DateTime",   "status": "string" }``` | Returns detailed paper information |

## Library Management APIs

| Name | HTTP Method | URL | Input | Output | Additional Notes |
|------|-------------|-----|-------|--------|------------------|
| **Load Library** | POST | `/api/library/load` | ```json {   "userId": "string",   "page": number,   "limit": number,   "sortBy": "string",   "order": "string" }``` | ```json {   "success": boolean,   "papers": Paper[],   "pagination": {     "totalPapers": number,     "totalPages": number,     "currentPage": number,     "limit": number   } }``` | Returns paginated list of user's papers |
| **Search Papers** | POST | `/api/papers/search` | ```json {   "userId": "string",   "searchInput": "string" }``` | ```json {   "availability": boolean,   "message": "string",   "searchResult": Paper[] }``` | Search through user's papers |

## WebSocket APIs

| Action | URL | Input | Output | Additional Notes |
|--------|-----|-------|--------|------------------|
| **Connect** | `wss://api.domain.com/$connect?token={jwt}` | JWT token in query params | Connection established | Stores connection in DynamoDB |
| **Disconnect** | `wss://api.domain.com/$disconnect` | Automatic | Connection cleaned up | Removes connection from DynamoDB |
| **Paper Process Status** | WebSocket message | ```json {   "action": "paperProcessStatus",   "paperId": "string" }``` | ```json {   "type": "PAPER_STATUS",   "paperId": "string",   "status": "string",   "title": "string",   "lastUpdated": "DateTime",   "errorMessage": "string" }``` | Real-time paper processing updates |

## Data Models

### User
```json
{
  "userId": "string",
  "email": "string", 
  "username": "string",
  "profilePicture": "string",
  "transLang": number
}
```

### Paper
```json
{
  "id": "string",
  "title": "string",
  "uploadDate": "DateTime",
  "status": "string",
  "thumbnailUrl": "string",
  "s3Key": "string",
  "starred": boolean
}
```

### KeyPoint
```json
{
  "point": "string",
  "page": number
}
```

### Citation
```json
{
  "authors": "string[]",
  "year": number,
  "publisher": "string",
  "apa": "string",
  "mla": "string"
}
```

