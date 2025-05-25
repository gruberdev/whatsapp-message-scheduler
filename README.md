# WhatsApp Message Scheduler

A modern WhatsApp message scheduling application built with a **Next.js frontend** and **NestJS backend** architecture.

## 🚀 Live Demo

- **Frontend**: [https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app](https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app)
- **Backend API**: [https://whatsapp-message-scheduler-production.up.railway.app/api](https://whatsapp-message-scheduler-production.up.railway.app/api)

## 🏗️ Architecture

This is a monorepo containing two applications:

- **Frontend** (`/frontend`): Next.js 15 with React 19, TypeScript, Tailwind CSS, and DaisyUI
- **Backend** (`/backend`): NestJS with WhatsApp Web.js integration, WebSocket support, and TypeScript

## ✨ Features

- 📱 **WhatsApp Web Integration**: Real WhatsApp QR code authentication using `whatsapp-web.js`
- 🔄 **Real-time Updates**: WebSocket connection for live status updates
- 🎨 **Modern UI**: Beautiful interface built with DaisyUI and Tailwind CSS
- 🔐 **Session Management**: Persistent WhatsApp sessions with LocalAuth
- 📡 **RESTful API**: Clean API endpoints for WhatsApp operations
- 🚀 **TypeScript**: Full type safety across frontend and backend
- 🎯 **Message Scheduling** - Schedule WhatsApp messages for future delivery
- 📊 **Session Management** - Handle multiple WhatsApp sessions
- 🔄 **Auto-reconnection** - Automatic session recovery and reconnection
- 🌐 **Cross-platform** - Works on desktop and mobile browsers

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-message-scheduler
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Start both applications**
   ```bash
   npm run dev
   ```

   Or test the setup with our verification script:
   ```bash
   npm run test:setup
   ```

This will start:
- Frontend on `http://localhost:3000`
- Backend on `http://localhost:3001`

## 📁 Project Structure

```
whatsapp-message-scheduler/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Main WhatsApp QR login page
│   │   │   └── layout.tsx   # App layout
│   │   └── ...
│   ├── package.json
│   ├── next.config.ts
│   └── tailwind.config.js
├── backend/                  # NestJS backend application
│   ├── src/
│   │   ├── whatsapp/        # WhatsApp module
│   │   │   ├── whatsapp.service.ts    # WhatsApp Web.js service
│   │   │   ├── whatsapp.controller.ts # REST API endpoints
│   │   │   └── whatsapp.gateway.ts    # WebSocket gateway
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
├── package.json              # Root package.json with monorepo scripts
└── README.md
```

## 🛠️ Development

### Available Scripts

**Root level scripts:**
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both applications for production
- `npm run start` - Start both applications in production mode
- `npm run lint` - Lint both applications
- `npm run test:setup` - Test the setup and start both applications with verification

**Frontend specific:**
- `npm run dev:frontend` - Start only the frontend
- `npm run build:frontend` - Build only the frontend
- `npm run lint:frontend` - Lint only the frontend

**Backend specific:**
- `npm run dev:backend` - Start only the backend
- `npm run build:backend` - Build only the backend
- `npm run lint:backend` - Lint only the backend

### Environment Variables

Create `.env` files in the respective directories:

**Frontend** (`frontend/.env.local`):
```env
BACKEND_URL=http://localhost:3001
```

**Backend** (`backend/.env`):
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## 🔌 API Endpoints

### WhatsApp API (`/api/whatsapp`)

- `GET /api/whatsapp/qr?sessionId=<id>` - Get QR code for WhatsApp authentication
- `GET /api/whatsapp/status?sessionId=<id>` - Get session status
- `GET /api/whatsapp/sessions` - Get all active sessions
- `POST /api/whatsapp/send` - Send a WhatsApp message
- `POST /api/whatsapp/disconnect` - Disconnect a session

### WebSocket Events

- `join-session` - Join a session room for real-time updates
- `leave-session` - Leave a session room
- `get-session-status` - Get current session status
- `session-status` - Receive session status updates
- `message-status` - Receive message delivery status

## 🔧 Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **DaisyUI** - Beautiful UI components
- **Socket.IO Client** - Real-time communication

### Backend
- **NestJS** - Progressive Node.js framework
- **WhatsApp Web.js** - WhatsApp Web API library
- **Socket.IO** - Real-time bidirectional communication
- **QRCode** - QR code generation
- **TypeScript** - Type safety
- **Puppeteer** - Headless Chrome for WhatsApp Web

## 🚀 Deployment

### Backend (Railway)

The backend is deployed on Railway with the following configuration:

```bash
# Deploy to Railway
./deploy-railway.sh
```

**Environment Variables:**
- `PORT=3001`
- `NODE_ENV=production`
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- `FRONTEND_URL=https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app`

### Frontend (Vercel)

The frontend is deployed on Vercel with automatic deployments from the main branch.

```bash
# Deploy to Vercel
cd frontend
vercel --prod
```

**Environment Variables:**
- `BACKEND_URL=https://whatsapp-message-scheduler-production.up.railway.app`

### Manual Deployment

1. **Backend to Railway:**
   ```bash
   cd backend
   railway login
   railway link
   railway up
   ```

2. **Frontend to Vercel:**
   ```bash
   cd frontend
   vercel login
   vercel --prod
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project uses WhatsApp Web.js which automates WhatsApp Web. Use responsibly and in accordance with WhatsApp's Terms of Service. The developers are not responsible for any misuse of this software.

## 🙏 Acknowledgments

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web API
- [Next.js](https://nextjs.org/) - React framework
- [DaisyUI](https://daisyui.com/) - Tailwind CSS components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
