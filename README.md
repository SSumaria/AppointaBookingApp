# Appointa - Smart Appointment & Client Management

Appointa is a comprehensive, full-stack web application designed for independent professionals and small businesses to manage their appointments and clients efficiently. It combines a powerful booking system, a lightweight CRM, and AI-powered features to streamline daily operations and enhance productivity.

---

## Key Features

### 1. Authentication & User Management
- **Secure Sign-up & Login**: Users can create an account using email and password or sign in seamlessly with their Google account.
- **Account Management**: A dedicated page for users to view their account details.
- **Data Deletion**: Users have full control to permanently delete their account and all associated data.

### 2. Client Management (CRM)
- **Centralized Client Database**: Keep a detailed record of all clients, including their contact information and a complete history of their bookings and notes.
- **Powerful Client Search**: Quickly find any client in your database by name.
- **Detailed Client View**: A dedicated page for each client shows all their past and upcoming appointments, along with a consolidated view of every note ever taken for them.

### 3. Advanced Booking System
- **Internal Booking Form**: Easily create new appointments for both new and existing clients. The form features smart client search to avoid duplicate entries.
- **Comprehensive Bookings List**: View all appointments in a detailed, filterable table.
- **Dual Calendar Views**:
    - **Monthly View**: Get a high-level overview of your schedule, with indicators for days that have bookings.
    - **Weekly View**: A detailed, time-blocked calendar that visualizes your week's appointments, similar to Google Calendar.
- **Edit & Cancel Bookings**: Modify appointment details or cancel them with just a few clicks.

### 4. AI-Powered Note Transcription
- **Voice-to-Note**: Record audio notes directly within a booking's note management dialog.
- **SOAP Note Formatting**: The recorded audio is sent to a Gemini-powered AI flow, which transcribes it and intelligently formats the content into a structured **SOAP (Subjective, Objective, Assessment, Plan)** note.
- **Note History & Management**: All notes for a booking are saved and can be edited or deleted.

### 5. Personalization & Integrations
- **Public Booking Page**: Every user gets a unique, shareable URL. Clients can visit this page to see your real-time availability and book appointments themselves.
- **Customizable Working Hours**: In the preferences, set your availability for each day of the week to control the slots shown on your public booking page.
- **Google Calendar Sync**: Connect your Google Calendar to automatically create, update, and delete events as you manage bookings in Appointa, ensuring your schedule is always in sync.
- **Dark Mode**: Choose between a light or dark theme for the application interface.

### 6. Automated Email Notifications
- **Transactional Emails**: The application automatically sends styled, professional emails for booking confirmations, updates, and cancellations to both the service provider and the client.
- **Aha Send Integration**: Utilizes the Aha Send API for reliable email delivery (currently configured to run in sandbox mode).

---

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with ShadCN UI components
- **Generative AI**: Google AI (Gemini) via Genkit
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Authentication (Email/Password, Google Provider)
- **Deployment**: Firebase App Hosting
- **Email**: Aha Send API

---

## Getting Started

To get started with this project in Firebase Studio, simply begin making requests to change the code. The environment is already configured and running.
