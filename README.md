# WhatsApp Message Scheduler 📱⏰

A modern web application that allows users to schedule WhatsApp messages using real WhatsApp Web integration. Built with Next.js 15, TypeScript, and Tailwind CSS.

## ✨ Features

- **Real WhatsApp Integration**: Uses `whatsapp-web.js` for authentic WhatsApp Web connection
- **QR Code Authentication**: Scan QR code with your phone to connect your WhatsApp account
- **Modern UI**: Beautiful interface built with DaisyUI and Tailwind CSS
- **TypeScript**: Full type safety throughout the application
- **Real-time Status**: Live connection status updates
- **Session Management**: Persistent WhatsApp sessions with automatic cleanup

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A WhatsApp account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-message-scheduler
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 How to Use

1. **Launch the Application**
   - Open the app in your browser
   - You'll see a WhatsApp-style login interface

2. **Connect Your WhatsApp**
   - Wait for the QR code to generate (may take 10-20 seconds)
   - Open WhatsApp on your phone
   - Go to Settings > Linked Devices > Link a Device
   - Scan the QR code displayed on the screen

3. **Authentication**
   - Once scanned, the app will authenticate and connect
   - Status will change from "Generating QR Code..." to "Ready"
   - Your WhatsApp account is now connected!

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, DaisyUI
- **WhatsApp Integration**: whatsapp-web.js
- **QR Code Generation**: qrcode library
- **Browser Automation**: Puppeteer (headless)

## 📁 Project Structure

```
src/
├── app/
│   ├── api/whatsapp/          # WhatsApp API endpoints
│   │   ├── qr/route.ts        # QR code generation and status
│   │   ├── status/route.ts    # Connection status
│   │   └── send/route.ts      # Message sending
│   ├── globals.css            # Global styles
│   └── page.tsx               # Main application page
├── lib/
│   └── whatsapp-service.ts    # WhatsApp service layer
└── components/                # Reusable components (future)
```

## 🔧 API Endpoints

- `GET /api/whatsapp/qr` - Generate QR code and get connection status
- `GET /api/whatsapp/status` - Check current connection status  
- `POST /api/whatsapp/send` - Send WhatsApp messages

## 🎨 UI Components

The application features a WhatsApp Web-inspired design with:
- **Loading States**: Smooth transitions and loading indicators
- **QR Code Display**: Clean, scannable QR code presentation
- **Status Updates**: Real-time connection status
- **Responsive Design**: Works on desktop and mobile devices

## 🔒 Security & Privacy

- **Local Authentication**: WhatsApp credentials stored locally using LocalAuth
- **No Data Storage**: Messages and contacts are not stored on our servers
- **Session Management**: Automatic cleanup of inactive sessions
- **Secure Connection**: Uses official WhatsApp Web protocol

## 🚧 Development

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Setup

The application uses dynamic imports to handle WhatsApp Web.js dependencies that are not compatible with browser environments. The Next.js configuration includes special webpack settings to handle these dependencies.

## 📝 Future Features

- [ ] Message scheduling functionality
- [ ] Contact management
- [ ] Message templates
- [ ] Bulk messaging
- [ ] Analytics dashboard
- [ ] Message history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project is for educational purposes. Please ensure you comply with WhatsApp's Terms of Service when using this application. The developers are not responsible for any misuse of this software.

## 🙏 Acknowledgments

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - WhatsApp Web API
- [Next.js](https://nextjs.org/) - React framework
- [DaisyUI](https://daisyui.com/) - Tailwind CSS components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
