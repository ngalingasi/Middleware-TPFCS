# GePG Bridge System

Complete integration bridge for Tanzania Government Electronic Payment Gateway (GePG) with modern web dashboard.

## 📦 Project Structure

```
gepg-bridge-system/
├── gepg-bridge-backend/     # Node.js/Express API Server
└── gepg-bridge-frontend/    # React Dashboard (Vite)
```

## 🚀 Features

### Backend (API Server)
- ✅ Bill submission and management
- ✅ Payment notification handling
- ✅ Bill control number reuse
- ✅ Bill cancellation
- ✅ Online payment support
- ✅ Reconciliation requests
- ✅ Digital signature support (PKCS#12)
- ✅ MySQL database
- ✅ RESTful API
- ✅ Webhook endpoints for GePG

### Frontend (Dashboard)
- ✅ Real-time statistics dashboard
- ✅ Bills management interface
- ✅ Payment tracking and monitoring
- ✅ Charts and analytics
- ✅ Responsive design
- ✅ Bill creation wizard
- ✅ Advanced filtering

## 📋 Prerequisites

- **Node.js** v14 or higher
- **MySQL** v5.7 or higher
- **GePG Credentials**:
  - Service Provider Code
  - System ID
  - Digital certificates (PKCS#12)
  - GePG server endpoint
- **Network**: VPN connection to GePG DataCenter

## 🛠️ Installation

### 1. Backend Setup

```bash
cd gepg-bridge-backend
npm install
```

Configure environment:
```bash
cp .env.example .env
# Edit .env with your configurations
```

Run database migrations:
```bash
npm run migrate
```

Start the server:
```bash
npm run dev
```

Backend will run on `http://localhost:5001`

### 2. Frontend Setup

```bash
cd gepg-bridge-frontend
npm install
```

Start development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

## 📖 Configuration

### Backend Configuration (.env)

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=gepg_bridge

# GePG Settings
GEPG_IP=your_gepg_ip
GEPG_PORT=your_gepg_port
GEPG_SP_CODE=SP023
GEPG_SUB_SP_CODE=2001
GEPG_SP_SYS_ID=your_system_id

# Certificates
CERT_PATH=./certificates/sp_certificate.p12
CERT_PASSWORD=your_cert_password
GEPG_PUBLIC_CERT_PATH=./certificates/gepg_public_cert.pem
```

### GePG Callback URLs

Configure these URLs in your GePG portal:
- Bill Response: `http://your-server:5001/api/bills/webhook/response`
- Payment Notification: `http://your-server:5001/api/payments/webhook/notification`
- Online Payment: `http://your-server:5001/api/payments/webhook/online-notification`

## 🔐 Digital Certificates

1. Place your PKCS#12 (.p12 or .pfx) certificate in `backend/certificates/`
2. Place GePG's public certificate (.pem) in `backend/certificates/`
3. Update certificate paths in `.env`

## 📡 API Endpoints

### Bills
- `POST /api/bills/create` - Create a bill
- `POST /api/bills/submit/:billId` - Submit to GePG
- `POST /api/bills/create-and-submit` - Create and submit
- `POST /api/bills/cancel/:billId` - Cancel bill
- `GET /api/bills` - List all bills
- `GET /api/bills/:billId` - Get bill details

### Payments
- `POST /api/payments/webhook/notification` - GePG payment webhook
- `POST /api/payments/webhook/online-notification` - Online payment webhook
- `GET /api/payments` - List all payments
- `GET /api/payments/:paymentId` - Get payment details
- `GET /api/payments/statistics/summary` - Payment statistics

### Dashboard
- `GET /api/dashboard/statistics` - Overall statistics
- `GET /api/dashboard/recent-activities` - Recent activities
- `GET /api/dashboard/payment-channels` - Channel distribution
- `GET /api/dashboard/daily-summary` - Daily summary
- `GET /api/dashboard/top-payers` - Top payers

## 🎯 Usage Examples

### Creating a Bill

```bash
curl -X POST http://localhost:5001/api/bills/create-and-submit \
  -H "Content-Type: application/json" \
  -d '{
    "billId": "BILL001",
    "billAmount": 50000,
    "billExpiryDate": "2025-12-31T23:59:59",
    "payerId": "P001",
    "payerName": "John Doe",
    "payerCellNumber": "255712345678",
    "payerEmail": "john@example.com",
    "billDescription": "Service payment",
    "currency": "TZS",
    "items": [
      {
        "billItemRef": "ITEM001",
        "billItemAmount": 50000,
        "gfsCode": "140206"
      }
    ]
  }'
```

### Cancelling a Bill

```bash
curl -X POST http://localhost:5001/api/bills/cancel/BILL001 \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer requested cancellation"}'
```

## 🗄️ Database Schema

Main tables:
- `bills` - Bill records
- `bill_items` - Bill line items
- `payments` - Payment transactions
- `reconciliation_requests` - Reconciliation data
- `api_logs` - Request/response logs
- `system_config` - System configurations

## 🔧 Development

### Backend Development
```bash
cd gepg-bridge-backend
npm run dev  # Auto-reload with nodemon
```

### Frontend Development
```bash
cd gepg-bridge-frontend
npm run dev  # Hot reload with Vite
```

## 🚀 Production Deployment

### Backend
```bash
cd gepg-bridge-backend
npm install --production
npm start
```

### Frontend
```bash
cd gepg-bridge-frontend
npm run build
# Serve the 'dist' folder with nginx or any static server
```

## 📊 Dashboard Features

- **Real-time Statistics**: Bills, payments, collections
- **Charts**: Payment trends, channel distribution
- **Bill Management**: Create, submit, cancel bills
- **Payment Tracking**: View all transactions
- **Filtering**: By status, date, type
- **Responsive Design**: Works on all devices

## 🔒 Security

- Digital signature verification
- HTTPS recommended for production
- Environment variables for sensitive data
- API request logging
- CORS configuration
- Helmet.js security headers

## 🐛 Troubleshooting

### Database Connection Failed
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists (run migrations)

### GePG Connection Issues
- Verify VPN connection to GePG
- Check GePG endpoint configuration
- Validate digital certificates

### Certificate Errors
- Ensure certificate paths are correct
- Verify certificate password
- Check certificate expiry date

## 📚 GePG Documentation

This system implements GePG API v4.0 specifications:
- Bill submission and management
- Payment notifications
- Digital signatures (PKCS#12)
- Reconciliation
- Online payments

## 🤝 Support

For issues related to:
- **GePG Integration**: Contact GePG support
- **Technical Issues**: Check logs in `backend/logs/`
- **Database**: Review migration scripts

## 📄 License

This project is provided as-is for GePG integration purposes.

## 🔄 Version

- Backend: v1.0.0
- Frontend: v1.0.0
- GePG API: v4.0

---

**Note**: This is a bridge system for GePG integration. Ensure you have proper authorization and credentials from Tanzania Government before deploying to production.
