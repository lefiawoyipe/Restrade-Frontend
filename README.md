# ResTrade

ResTrade is a campus marketplace built for students to buy, sell, and exchange useful items within their community. The platform supports student listings, escrow-based orders, pickup verification, reviews, disputes, recommendations, and administrative moderation.

## Features

- Browse available campus listings
- Create, edit, and manage item listings
- Search and filter marketplace items
- View detailed product and seller information
- Buy items through an escrow-based order flow
- Confirm pickup and receipt using QR codes
- Report order problems and submit dispute evidence
- Negotiate supported order outcomes
- Review sellers after completed transactions
- Manage account settings and recommendation preferences
- Receive realtime updates for relevant marketplace and order changes
- Admin tools for:
  - User management
  - Inventory and listing moderation
  - Order and escrow visibility
  - Dispute handling
  - Audit history
  - MFA-protected decisions

## Tech Stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Supabase](https://supabase.com/)
  - Authentication
  - PostgreSQL database
  - Realtime updates
  - Storage for private evidence files
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Playwright](https://playwright.dev/) for browser testing
- [ZXing](https://github.com/zxing-js/library) for QR scanning
- [qrcode](https://github.com/soldair/node-qrcode) for QR generation

## Requirements

- Node.js 20 or newer
- npm
- A configured Supabase project
- A modern browser with camera support for QR scanning features

## Getting Started

Install the dependencies:

```bash
npm install
```


## Deployment

This application is deployed on [Vercel](https://vercel.com/).

Visit the live application at [restrade.vercel.app](https://restrade.vercel.app).