# Photo Direct Print

Small Node + Express app to capture a photo from the browser and print it to a Windows printer using mspaint.

Requirements:

- Windows (server-side printing uses mspaint)
- Node.js 14+

Install and run:

```powershell
npm install
npm start
```

Open http://localhost:3000 in a browser, allow camera access, capture an image, and click Print.

If server-side printing fails, the app falls back to opening a browser print dialog.

Security note: This is a demo. In production, validate inputs, secure endpoints, and handle printer permissions.
