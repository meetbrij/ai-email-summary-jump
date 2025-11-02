# AI Email Sorting App

An AI-powered email management application that automatically classifies and summarizes emails from multiple Gmail accounts using OpenAI GPT-4o-mini. Built as a production-ready MVP with Next.js 14, TypeScript, and PostgreSQL.

## Features

### Core Features
- 🔐 **Secure Authentication** - Google OAuth via NextAuth.js with encrypted token storage
- 📧 **Multi-Account Gmail Support** - Connect up to 5 Gmail accounts per user
- 🤖 **AI Email Classification** - Automatically categorize emails into user-defined categories
- 📝 **Smart Summarization** - AI-generated 1-2 sentence summaries for every email
- 🗂️ **Custom Categories** - Create unlimited custom categories with color coding
- 🔍 **Advanced Search & Filters** - Search emails by subject, sender, or summary
- 📊 **Dashboard Analytics** - Track total, categorized, and uncategorized emails
- 🔕 **Unsubscribe Detection** - Automatically extract unsubscribe links from emails
- 🗑️ **Bulk Actions** - Delete multiple emails at once from both app and Gmail
- 🌙 **Dark Mode Support** - Full dark mode CSS (toggle UI coming soon)
- 📱 **Responsive Design** - Mobile-first UI built with Tailwind CSS

### Security Features
- AES-256-GCM encryption for OAuth refresh tokens
- HTML sanitization with DOMPurify for safe email rendering
- CSRF protection via NextAuth
- Server-side session management
- User data isolation at database level

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide Icons
- **State Management**: @tanstack/react-query, React hooks
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v4 with Google OAuth
- **AI**: OpenAI GPT-4o-mini
- **APIs**: Gmail API (with rate limiting via p-queue)
- **Deployment**: Render (Web Service + PostgreSQL)

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** 18.x or higher
- **npm** or **yarn**
- **PostgreSQL** 14.x or higher
- **Google Cloud Console** account (for OAuth credentials)
- **OpenAI API** key

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai_email_sorting_app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Gmail API** and **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Configure OAuth consent screen (add test users if needed)
6. Create OAuth 2.0 Client ID (Application type: Web application)
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for NextAuth)
   - `http://localhost:3000/api/gmail/callback` (for additional accounts)
8. Copy the **Client ID** and **Client Secret**

### 4. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key and copy it

### 5. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in the following:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_email_sorting"

# NextAuth
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenAI
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# Encryption (for token storage)
ENCRYPTION_KEY="<generate with: openssl rand -base64 32>"

# App Configuration
APP_URL="http://localhost:3000"
NODE_ENV="development"
LOG_LEVEL="info"

# Optional: Rate Limiting
MAX_EMAILS_PER_SYNC=50
MAX_EMAILS_PER_PROCESS=20
```

### 6. Set Up Database

Create a PostgreSQL database:

```bash
createdb ai_email_sorting
```

Run Prisma migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev --name init
```

### 7. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Usage

### First-Time Setup

1. **Sign In**: Navigate to `http://localhost:3000` and click "Sign in with Google"
2. **Create Categories**: Go to Categories page and create at least 2 categories (e.g., "Work", "Personal", "Newsletters")
3. **Sync Emails**: Click the "Sync Emails" button on the dashboard to fetch and classify emails
4. **View Results**: Browse categorized emails, view summaries, and manage your inbox

### Adding Additional Gmail Accounts

1. Go to **Settings** → **Gmail Accounts**
2. Click **Add Account**
3. Authorize the new Gmail account (max 5 accounts)
4. All accounts will sync when you click "Sync Emails"

### Managing Categories

1. Navigate to **Categories** page
2. Create, edit, or delete categories
3. Assign colors to categories for visual organization
4. Recategorize emails by clicking on an email and selecting a new category

### Bulk Actions

1. Go to **Emails** page
2. Select multiple emails using checkboxes
3. Click **Delete Selected** to remove emails from both the app and Gmail

## Project Structure

```
ai_email_sorting_app/
├── app/
│   ├── api/                     # API routes
│   │   ├── auth/                # NextAuth.js authentication
│   │   ├── categories/          # Category CRUD
│   │   ├── emails/              # Email management
│   │   ├── gmail/               # Gmail OAuth & account management
│   │   ├── sync/                # Email sync from Gmail
│   │   └── process/             # AI classification & summarization
│   ├── dashboard/               # Dashboard pages
│   ├── login/                   # Login page
│   └── providers.tsx            # React Query & Session providers
├── components/
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── auth.ts                  # Authentication helpers
│   ├── auth-options.ts          # NextAuth configuration
│   ├── db.ts                    # Prisma client
│   ├── encryption.ts            # Token encryption (AES-256-GCM)
│   ├── gmail.ts                 # Gmail API wrapper
│   ├── openai.ts                # OpenAI integration
│   └── unsubscribe-detector.ts  # Extract unsubscribe links
├── prisma/
│   └── schema.prisma            # Database schema
├── middleware.ts                # Route protection
└── CLAUDE.md                    # AI assistant context
```

## API Routes

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth.js OAuth handler

### Categories
- `GET /api/categories` - List user's categories
- `POST /api/categories` - Create new category
- `PATCH /api/categories/[id]` - Update category
- `DELETE /api/categories/[id]` - Delete category

### Gmail Accounts
- `GET /api/gmail/accounts` - List connected Gmail accounts
- `GET /api/gmail/add-account` - Initiate OAuth flow for additional accounts
- `GET /api/gmail/callback` - OAuth callback for additional accounts
- `PATCH /api/gmail/accounts/[id]` - Update account (activate/deactivate)
- `DELETE /api/gmail/accounts/[id]` - Remove Gmail account

### Emails
- `GET /api/emails` - List emails (with filters)
- `GET /api/emails/[id]` - Get single email details
- `PATCH /api/emails/[id]/category` - Recategorize email
- `PATCH /api/emails/[id]/archive` - Toggle archive status
- `POST /api/emails/bulk-delete` - Delete multiple emails
- `GET /api/emails/stats` - Dashboard statistics
- `GET /api/emails/unsubscribe` - List emails with unsubscribe links

### Sync & Processing
- `POST /api/sync` - Fetch new emails from all Gmail accounts
- `POST /api/process` - Run AI classification on uncategorized emails

## Database Commands

```bash
# Generate Prisma client (after schema changes)
npx prisma generate

# Create and apply migration (development)
npx prisma migrate dev

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth.js session encryption |
| `NEXTAUTH_URL` | Yes | Application URL (with protocol) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Client Secret |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | Yes | OpenAI model (e.g., gpt-4o-mini) |
| `ENCRYPTION_KEY` | Yes | 32-byte key for token encryption |
| `APP_URL` | No | Application URL (defaults to NEXTAUTH_URL) |
| `NODE_ENV` | No | Environment (development/production) |
| `LOG_LEVEL` | No | Logging level (info/debug/error) |
| `MAX_EMAILS_PER_SYNC` | No | Max emails to fetch per sync (default: 50) |
| `MAX_EMAILS_PER_PROCESS` | No | Max emails to process with AI (default: 20) |

## Deployment

### Deploying to Render

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → New → PostgreSQL
   - Copy the `Internal Database URL`

2. **Create Web Service**
   - Go to Render Dashboard → New → Web Service
   - Connect your Git repository
   - Configure:
     - **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
     - **Start Command**: `npm start`
     - **Environment Variables**: Add all variables from `.env`

3. **Update Google OAuth**
   - Add production redirect URIs to Google Cloud Console:
     - `https://your-app.onrender.com/api/auth/callback/google`
     - `https://your-app.onrender.com/api/gmail/callback`

4. **Update Environment Variables**
   - Set `NEXTAUTH_URL` to `https://your-app.onrender.com`
   - Set `APP_URL` to `https://your-app.onrender.com`
   - Set `NODE_ENV` to `production`

## Common Issues

### OAuth "redirect_uri_mismatch" Error
**Solution**: Add callback URLs to Google Cloud Console Authorized redirect URIs:
- `http://localhost:3000/api/auth/callback/google` (NextAuth)
- `http://localhost:3000/api/gmail/callback` (additional accounts)

### Session Not Loading (Stuck Spinner)
**Solution**:
- Clear browser cookies
- Ensure `NEXTAUTH_SECRET` is set
- Check that `export const dynamic = 'force-dynamic'` is added to NextAuth route

### Pages Showing 404 for JavaScript Bundles
**Solution**:
```bash
rm -rf .next
npm run dev
```

### Gmail API Token Expired
**Solution**: The app automatically refreshes tokens. If it fails, the account is marked inactive. Re-authenticate from Settings.

### Database Connection Error
**Solution**:
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname`
- Ensure database exists: `createdb ai_email_sorting`

## Roadmap

### Completed ✅
- Multi-account Gmail support (up to 5 accounts)
- AI email classification and summarization
- Custom categories with color coding
- Dashboard with statistics
- Email search and filtering
- Bulk delete functionality
- Unsubscribe link detection
- Dark mode CSS

### In Progress 🚧
- Playwright unsubscribe automation
- Bulk recategorize endpoint
- Dark mode toggle UI

### Planned 📅
- Comprehensive test suite (Jest + React Testing Library)
- Email templates and canned responses
- Schedule sync (cron jobs)
- Export emails to CSV
- Advanced analytics dashboard

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Prisma](https://www.prisma.io/) - Database ORM
- [OpenAI](https://openai.com/) - AI models
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Gmail API](https://developers.google.com/gmail/api) - Email access

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ using Next.js 14 and OpenAI**
