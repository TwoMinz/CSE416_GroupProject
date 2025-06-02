# SummarAIze - Use Cases

## Sign Up
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | High |
| **Scenario** | 1. The user enters registration details or uses Google OAuth.<br/>2. The system validates and creates an account.<br/>3. The user is redirected to the main dashboard. |
| **Extension** | If the email is already in use, the system notifies the user and prompts for another email. |

## Login
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | High |
| **Scenario** | 1. The user enters their login credentials or uses Google OAuth.<br/>2. The system verifies the credentials and grants access to the platform. |
| **Extension** | If the credentials are incorrect, the system displays an error message and prompts for re-entry. |

## Logout
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | High |
| **Scenario** | 1. The user clicks the "Logout" button.<br/>2. The system logs out the user and redirects to the main page. |
| **Extension** | If the session expires, the system automatically logs out the user and prompts for re-login. |

## Drag and Drop - Summarization, Recommendation, and Citation
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | High |
| **Scenario** | 1. The user uploads a research paper by dragging and dropping it.<br/>2. The system processes the file, extracts key information, and generates a summary.<br/>3. The system displays extracted citations and recommendations for related papers. |
| **Extension** | - If the uploaded file is not a valid PDF, the system displays an error message.<br/>- Users are also able to upload the PDF file with the system file explorer. |

## Multi-Language Summarization
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | Medium |
| **Scenario** | 1. The user selects a preferred language for summarization.<br/>2. The system generates a summary in the selected language.<br/>3. The summary is displayed in the preferred language. |
| **Extension** | If the language is not supported, the user can not select that language from the language list. |

## Profile Management
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | Medium |
| **Scenario** | 1. The user accesses the profile settings.<br/>2. The user updates their profile picture, name, or password.<br/>3. The system saves and updates the user information. |
| **Extension** | - Users can not select the unsupported format picture file.<br/>- If the password update fails (e.g., weak password), the system prompts the user to enter a stronger password. |


## Library (Archive) Management
| Attribute | Description |
|-----------|-------------|
| **Primary Actor** | Customer |
| **Priority** | High |
| **Scenario** | 1. The user accesses their personal library.<br/>2. The system displays previously saved summarized papers. |
| **Extension** | - If no papers are saved, the system displays a message indicating an empty library.<br/> |