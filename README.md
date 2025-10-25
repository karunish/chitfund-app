# Veritas Ledger: Collaborative Financial Management

## Short Tagline

A comprehensive web application designed to streamline the management of community-based financial systems, such as chit funds, by tracking contributions, managing loan requests, and providing administrative oversight.

## Purpose and Problem Solved

Traditional methods of managing group savings and loan systems often involve manual record-keeping, leading to inefficiencies, errors, and a lack of transparency. This application aims to digitize and centralize these processes, offering a secure and accessible platform for members to track their financial activities and for administrators to manage the fund efficiently. It addresses the need for a modern, transparent, and user-friendly system for collective financial management.

## Key Features

### User Features:

*   **User Dashboard:** Provides a personal financial overview, including outstanding amounts, recent transactions, and a summary of loan requests.
*   **Contribution Tracking:** Allows users to submit payment proofs for monthly contributions and view their submission history.
*   **Loan Management:** Enables members to request loans based on eligibility, track the status of their requests, and view repayment details.
*   **Notifications:** In-app alerts for important updates, loan repayment reminders, and contribution status changes.
*   **Profile Management:** View personal details and membership start date.

### Admin Features:

*   **Admin Dashboard:** A centralized hub for administrators to manage the main account balance, process pending contribution proofs, and review new loan requests.
*   **User Management:** Tools for creating, editing, and deleting user accounts, including setting passwords and viewing individual transaction and loan histories.
*   **Loan Management:** Overview of all loans, with options to disburse approved loans, mark loans as closed, and delete loan records.
*   **Historical Data Entry:** Manually add historical contributions for users over a period and create historical loan records.
*   **Manual Transaction Log:** Manually record deposits or withdrawals for any user, updating all relevant balances.
*   **Reporting & Exports:** Functionality to generate and export comprehensive CSV reports of all transactions, user profiles, and loan records.
*   **Monthly Lists:** Generate lists of monthly contributions and loan repayments due.
*   **Cron Job Testing:** Manually trigger scheduled jobs for monthly dues, notifications, and late fees for testing purposes.

### General Features:

*   **Authentication & Authorization:** Secure user login and role-based access control (user/admin).
*   **Responsive Design:** Ensures a consistent and usable experience across various devices (web and mobile).
*   **Theme Toggle:** Light and dark mode support.

## Technologies Used

This project is built using a modern web development stack, showcasing proficiency in various front-end and back-end technologies:

### Front-end:

*   **React:** For building dynamic and interactive user interfaces.
*   **TypeScript:** Enhances code quality and maintainability with static typing.
*   **Tailwind CSS:** For utility-first styling, enabling rapid and consistent UI development.
*   **shadcn/ui:** A collection of beautifully designed, accessible, and customizable UI components built with Radix UI and Tailwind CSS.
*   **React Router:** For declarative routing within the single-page application.
*   **React Query (TanStack Query):** For efficient data fetching, caching, and synchronization.

### Back-end/Database/Auth:

*   **Supabase:** Utilized for authentication, database management (PostgreSQL), serverless functions (Edge Functions), and file storage (Supabase Storage).

## How to Run Locally

To set up and run this project on your local machine, you would typically follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install
    ```
3.  **Configure Supabase:**
    *   Create a Supabase project.
    *   Set up your database schema, authentication rules, and Edge Functions as defined in the `supabase` directory of this project.
    *   Create a `.env` file in the root directory and add your Supabase project URL and Anon Key:
        ```
        VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
        VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
        ```
4.  **Start the development server:**
    ```bash
    npm run dev
    # or yarn dev
    ```
    The application should now be running on `http://localhost:8080` (or another port if configured).

## Screenshots / Demo
