# **App Name**: Apointa

## Core Features:

- New Booking Page: Page with input fields for 'Client Name', 'Client Contact', 'Service/Procedure', 'Appointment Date', and 'Appointment Time'.
- Submit Booking Button: A button to submit the booking form.
- Database Setup: Database setup with 'Clients' (ClientID, ClientName, ClientContact) and 'Appointments' (AppointmentID, ClientID, ServiceProcedure, AppointmentDate, AppointmentTime) tables.
- Submit Action Logic: Check if client exists, create new client or retrieve ClientID, and create a new appointment record.
- Confirmation Message: Display a confirmation message after successful booking.

## Style Guidelines:

- Primary color: calming blue (#3498db) for a professional feel.
- Secondary color: light gray (#ecf0f1) for backgrounds and subtle accents.
- Accent: teal (#008080) for the submit button and other key interactive elements.
- Clean and readable sans-serif fonts for all text elements.
- Simple, outline-style icons for a modern look.
- Well-spaced and organized form elements for ease of use.

## Original User Request:
Goal: Create the initial booking form and set up the database to store appointment and client information.

Instructions:

"Create a new application (suggested name: ServiceBooker Pro).

Create a page named 'New Booking'.
On this page, add the following input fields:
'Client Name' (Text Input, Required)
'Client Contact' (Text Input, Optional - Phone or Email)
'Service/Procedure' (Text Input, Required - We'll make this a dropdown later)
'Appointment Date' (Date Picker, Required)
'Appointment Time' (Time Selector, Required - For now, allow any time selection)
A 'Submit Booking' button.
Set up a database with two tables:
Clients Table: Columns for ClientID (unique ID, auto-generated), ClientName (Text), ClientContact (Text).
Appointments Table: Columns for AppointmentID (unique ID, auto-generated), ClientID (linking to Clients table), ServiceProcedure (Text), AppointmentDate (Date), AppointmentTime (Time).
Action on Submit: When the 'Submit Booking' button is clicked:
Check if a client with the entered 'Client Name' already exists in the Clients table.
If not, create a new record in the Clients table with the 'Client Name' and 'Client Contact'.
If the client exists, retrieve their ClientID.
Create a new record in the Appointments table, linking the ClientID and saving the 'Service/Procedure', 'Appointment Date', and 'Appointment Time'.
Show a success message like 'Booking Confirmed!'"
  