# AI Usage and Original ChatGPT Conversations

## AI Tool Used

I used ChatGPT as a development assistant while building the Car Dealership Inventory System. I used it to understand errors, troubleshoot implementation issues, improve test isolation, review test results, and improve project documentation.

## Original ChatGPT Conversations

The following public conversation link was provided as a record of AI assistance during development.

### 1. Backend Testing and Development

- **Original conversation:** https://chatgpt.com/share/6add785d-3f14-83ec-8f1b-a31bee4ca897
- **Purpose:** Document AI assistance related to backend development and testing.

This is the original conversation link currently available in this file. Additional original conversation links or unedited chat logs should be included when available to document other AI-assisted work on the project.

## Summary of AI Assistance

The following sections are summaries of AI-assisted work. They are not verbatim transcripts and are not presented as substitutes for original conversation records.

### 1. Backend Testing

**Prompt summary:** Help me fix the backend tests and configure a temporary SQLite database so the tests do not modify the development database.

**How I used the response:** I updated the pytest fixture and test cases to use a separate in-memory database. I ran the test suite to check the changes.

### 2. Authentication Configuration

**Prompt summary:** Help me understand and resolve the `JWT_SECRET_KEY` error that prevented pytest from loading the application.

**How I used the response:** I configured a test-only secret for the test environment so the application could be imported during testing.

### 3. Test Verification

**Prompt summary:** Help me interpret pytest output and understand the warning reported by the Starlette test-client integration.

**How I used the response:** I ran the backend test suite and checked the results, including the passing test count and deprecation warning.

### 4. Project Documentation

**Prompt summary:** Help me structure the README with project details, setup instructions, API endpoints, testing instructions, and an AI usage disclosure.

**How I used the response:** I reviewed and updated the README to explain the project, how to run it, and how to verify the application.

## Reflection on AI Usage

ChatGPT helped me investigate errors, understand testing issues, and organize project documentation. I used its suggestions as development assistance and ran relevant commands locally to verify the results.

Using AI helped me work through problems more efficiently, but generated suggestions still needed to be reviewed and tested. I remain responsible for understanding the implementation, verifying the results, and explaining my technical decisions.

## Previously Recorded Verification (Historical)

An earlier local run was recorded as 15 backend tests passed, zero failures, one deprecation warning, and successful frontend build and lint checks. Those results predate the current revision and must not be treated as verification of the current files. See `TEST_REPORT.md` for the actual status of this revision.

## Original Conversation Record Requirement

This file distinguishes the original conversation link currently available from summaries of AI assistance. The summaries are not raw, unedited chat logs.

The assignment requires raw, unedited AI chat logs or public links to original conversations. Before submission, I will check that the available original records adequately document the AI-assisted work and add further genuine links or unedited logs where available. I will not present summaries as original transcripts.


## This Chat Session

- **Original conversation:** https://chatgpt.com/share/6addf113-6190-83e8-93e7-86506b3b3d23
- **Purpose:** Document assistance with GitHub repository setup, test verification, README updates, and AI usage documentation.

This link points to the original ChatGPT conversation. The summaries elsewhere in this file are not verbatim transcripts and should not be treated as substitutes for original conversation records.
