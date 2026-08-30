# GePG Bridge - API Testing Guide

## 📦 Import Collections

### Postman
1. Open Postman
2. Click "Import" button
3. Select `GePG_Bridge_Postman_Collection.json`
4. Collection will appear in your workspace

### Insomnia
1. Open Insomnia
2. Go to Application menu → Preferences → Data
3. Click "Import Data" → "From File"
4. Select `GePG_Bridge_Insomnia.json`
5. Collection will be imported

## 🔑 Authentication Flow

### 1. Login
**Endpoint:** `POST /api/auth/login`

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@gepg-bridge.local",
      "fullName": "System Administrator",
      "role": "ADMIN"
    }
  }
}
```

### 2. Set Bearer Token
After login, copy the token and:

**Postman:**
- Go to collection settings
- Set `auth_token` variable with the token
- All authenticated requests will use it automatically

**Insomnia:**
- Go to environment
- Set `auth_token` with the token value
- Requests will include: `Authorization: Bearer {{auth_token}}`

## 🧪 Testing Workflow

### Step 1: Authentication
1. **Login** - Get your auth token
2. **Get Current User** - Verify authentication
3. **Register User** (Admin only) - Create test users

### Step 2: Create Bills
1. **Create Bill** - Create without submitting
2. **Create and Submit Bill** - Create and submit to GePG
3. **Get All Bills** - View created bills
4. **Get Bill by ID** - View specific bill details

### Step 3: Bill Operations
1. **Submit Bill to GePG** - Submit existing bill
2. **Cancel Bill** - Cancel a bill with reason

### Step 4: View Payments
1. **Get All Payments** - List all payments
2. **Get Payment by ID** - View payment details
3. **Get Payment Statistics** - View payment analytics

### Step 5: Dashboard
1. **Get Statistics** - Overall system statistics
2. **Get Recent Activities** - Recent system activities
3. **Get Payment Channels** - Payment channel distribution
4. **Get Daily Summary** - Daily payment summary

### Step 6: Logs (Admin Only)
1. **Get Activity Logs** - View user activity logs
2. **Get API Logs** - View API request logs
3. **Get Logs Statistics** - Log analytics
4. **Cleanup Logs** - Remove old logs

### Step 7: User Management (Admin Only)
1. **Get All Users** - List all users
2. **Get User by ID** - View user details
3. **Update User** - Modify user information
4. **Reset User Password** - Reset user password
5. **Delete User** - Remove user account

## 📝 Default Test Accounts

| Username | Password  | Role   | Description           |
|----------|-----------|--------|-----------------------|
| admin    | admin123  | ADMIN  | Full system access    |
| user1    | admin123  | USER   | Standard user access  |
| viewer   | admin123  | VIEWER | Read-only access      |

## 🔍 Testing Scenarios

### Scenario 1: Complete Bill Lifecycle
1. Login as admin
2. Create and submit a new bill
3. Verify bill appears in bills list
4. Check dashboard statistics updated
5. View activity logs for bill creation

### Scenario 2: Payment Flow
1. Create a bill (control number generated)
2. Simulate payment via GePG webhook (use Postman)
3. Check payment appears in payments list
4. Verify bill status changed to PAID
5. Check payment statistics updated

### Scenario 3: User Management
1. Login as admin
2. Register a new user
3. View all users
4. Update user details
5. Reset user password
6. Login as new user
7. Verify limited access based on role

### Scenario 4: Logs and Monitoring
1. Perform various actions (create bills, payments, etc.)
2. View activity logs to see all actions
3. Filter logs by date, action, entity
4. View log details with request/response data
5. Check logs statistics

## ⚠️ Common Issues

### Issue: 401 Unauthorized
**Solution:** Token expired or invalid. Login again to get new token.

### Issue: 403 Forbidden
**Solution:** Insufficient permissions. Use admin account or check user role.

### Issue: 404 Not Found
**Solution:** Check endpoint URL and ensure resource exists.

### Issue: 500 Internal Server Error
**Solution:** Check backend server logs. May be database connection issue.

## 🎯 API Response Codes

| Code | Meaning                | Action Required           |
|------|------------------------|---------------------------|
| 200  | Success                | None                      |
| 201  | Created                | Resource created          |
| 400  | Bad Request            | Check request body        |
| 401  | Unauthorized           | Login or refresh token    |
| 403  | Forbidden              | Check permissions         |
| 404  | Not Found              | Verify resource ID        |
| 500  | Server Error           | Check server logs         |

## 🔐 Security Notes

1. **Never share tokens** - Tokens are sensitive credentials
2. **Use HTTPS in production** - Never send tokens over HTTP
3. **Rotate passwords regularly** - Change default passwords
4. **Limit admin access** - Only give admin role when necessary
5. **Monitor logs** - Regularly check activity logs for suspicious activity

## 📊 Sample Test Data

### Sample Bill
```json
{
  "billId": "TEST-001",
  "billAmount": 50000,
  "billExpiryDate": "2025-12-31T23:59:59",
  "payerId": "TEST-PAYER-001",
  "payerName": "Test User",
  "payerCellNumber": "255712345678",
  "payerEmail": "test@example.com",
  "billDescription": "Test payment",
  "currency": "TZS",
  "billPayOption": 1,
  "items": [
    {
      "billItemRef": "ITEM-001",
      "billItemAmount": 50000,
      "gfsCode": "140206"
    }
  ]
}
```

### Sample Payment Notification (Webhook)
```json
{
  "transactionId": "TXN001",
  "spCode": "SP023",
  "payRefId": "PAY001",
  "billId": "TEST-001",
  "paymentControlNumber": "990123456789",
  "paidAmount": 50000,
  "currency": "TZS",
  "transactionDateTime": "2025-01-21T10:30:00",
  "usedPaymentChannel": "MOBILE",
  "payerName": "Test User",
  "pspName": "Test Bank"
}
```

## 🚀 Advanced Testing

### Load Testing
Use Postman's Collection Runner or Newman CLI to:
1. Run multiple requests sequentially
2. Test with different datasets
3. Measure API response times
4. Verify consistency under load

### Integration Testing
1. Create bill in your system
2. Submit to GePG (mock or real)
3. Verify control number received
4. Simulate payment webhook
5. Verify payment processed
6. Check reconciliation

### Automated Testing
Use collection variables and scripts to:
1. Auto-extract tokens after login
2. Generate unique bill IDs
3. Chain requests together
4. Assert response values
5. Generate test reports

## 📞 Support

For API issues:
1. Check server logs: `backend/logs/`
2. Verify database connectivity
3. Check GePG network connection
4. Review activity logs in dashboard
5. Contact system administrator

---

**Remember:** Always test in a development environment before deploying to production!
