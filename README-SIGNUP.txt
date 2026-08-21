SE Connect Self-Signup Add-on

This package ADDS new files only. It does not replace or modify the existing Startup form or SE Connect code.

Upload these files to the Madhi1615/Startup repository:
- signup.html
- signup-admin.html
- assets/signup.js
- assets/signup-admin.js

Do NOT replace:
- index.html
- assets/app.js
- assets/style.css
- assets/form-schema.js
- assets/config.js

Public signup URL after upload:
https://madhi1615.github.io/Startup/signup.html

Admin approval URL:
https://madhi1615.github.io/Startup/signup-admin.html

Supabase OTP setup:
Authentication > Email Templates > Magic Link
Use {{ .Token }} in the template so the applicant receives an OTP code.

Recommended template:
<h2>SE Connect email verification</h2>
<p>Your verification code is:</p>
<h1>{{ .Token }}</h1>
<p>Enter this code on the SE Connect signup page.</p>

Flow:
1. Applicant enters real email.
2. Supabase sends OTP.
3. Applicant verifies OTP.
4. Applicant completes the existing founder form questions.
5. Applicant chooses a SE Connect username and password.
6. Application is stored as Pending.
7. Admin signs into signup-admin.html with existing SE Connect admin credentials.
8. Admin approves.
9. Approval changes the auth email internally to username@members.example.com and creates an active member profile.
10. Applicant logs into https://se-connect.vercel.app using the chosen username and the SAME password created during signup.
