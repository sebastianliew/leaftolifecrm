Invoice PDFs Storage
====================

This directory is used for invoice PDF storage.

LOCAL DEVELOPMENT:
- Invoice PDFs are generated and stored in this folder
- Files are served directly from this folder

PRODUCTION (Azure):
- If Azure Blob Storage credentials are configured:
  * PDFs are uploaded to Azure Blob Storage (persistent, scalable)
  * This folder acts as a temporary cache
  * Files are served from Azure Blob Storage

- If Azure Blob Storage credentials are NOT configured:
  * PDFs are stored in this folder (ephemeral - will be lost on app restart)
  * Files are served from this folder
  * Recommended: Set up Azure Blob Storage for production

SETUP AZURE BLOB STORAGE:
1. Create an Azure Storage Account
2. Add environment variables:
   - AZURE_STORAGE_CONNECTION_STRING (recommended)
   OR
   - AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY
3. The application will automatically use Blob Storage when credentials are present

NOTE: PDF files in this folder are NOT committed to git for security reasons.
Only this README.txt is version controlled to ensure the folder structure exists.
