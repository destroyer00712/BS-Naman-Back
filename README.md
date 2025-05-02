# BSGold Jewelry API

Backend API for the BSGold jewelry management system, featuring automatic database migration and schema validation.

## Features

- Automatic database schema updates on server restart
- Schema validation to ensure database integrity
- Workers can have multiple phone numbers (primary and secondary)
- API calls work with either primary or secondary phone numbers
- Detailed logging of all operations
- Worker reassignment with WhatsApp notifications

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=jewelry_db
   LOG_LEVEL=info
   NODE_ENV=development
   ```
4. Start the server:
   ```
   npm start
   ```

## Worker API Endpoints

### Create Worker
- **Endpoint**: POST `/api/workers`
- **Input**:
  ```json
  {
    "name": "John Doe",
    "primary_phone": "1234567890",
    "secondary_phone": "9876543210" // Optional
  }
  ```
- **Output (Success)**:
  ```json
  {
    "message": "Worker created successfully",
    "worker": {
      "id": 1,
      "name": "John Doe",
      "phones": [
        { "phone_number": "1234567890", "is_primary": true },
        { "phone_number": "9876543210", "is_primary": false }
      ],
      "created_at": "2023-06-15T12:30:45.000Z"
    }
  }
  ```

### Get All Workers
- **Endpoint**: GET `/api/workers`
- **Output**:
  ```json
  {
    "workers": [
      {
        "id": 1,
        "name": "John Doe",
        "phones": [
          { "phone_number": "1234567890", "is_primary": true },
          { "phone_number": "9876543210", "is_primary": false }
        ],
        "created_at": "2023-06-15T12:30:45.000Z",
        "updated_at": "2023-06-15T12:30:45.000Z"
      }
    ]
  }
  ```

### Get Worker by Phone Number
- **Endpoint**: GET `/api/workers/:phoneNumber`
- **Note**: Works with either primary or secondary phone number
- **Output (Success)**:
  ```json
  {
    "worker": {
      "id": 1,
      "name": "John Doe",
      "phones": [
        { "phone_number": "1234567890", "is_primary": true },
        { "phone_number": "9876543210", "is_primary": false }
      ],
      "created_at": "2023-06-15T12:30:45.000Z",
      "updated_at": "2023-06-15T12:30:45.000Z"
    }
  }
  ```

### Update Worker
- **Endpoint**: PUT `/api/workers/:phoneNumber`
- **Note**: Works with either primary or secondary phone number
- **Input**:
  ```json
  {
    "name": "John Smith",
    "primary_phone": "5551234567", // Optional - if provided, updates primary phone
    "secondary_phone": "5559876543" // Optional - if provided, adds or updates secondary phone
  }
  ```
- **Output (Success)**:
  ```json
  {
    "message": "Worker updated successfully",
    "worker": {
      "id": 1,
      "name": "John Smith",
      "phones": [
        { "phone_number": "5551234567", "is_primary": true },
        { "phone_number": "5559876543", "is_primary": false }
      ],
      "created_at": "2023-06-15T12:30:45.000Z",
      "updated_at": "2023-06-15T14:45:30.000Z"
    }
  }
  ```

### Delete Worker
- **Endpoint**: DELETE `/api/workers/:phoneNumber`
- **Note**: Works with either primary or secondary phone number
- **Output (Success)**:
  ```json
  {
    "message": "Worker deleted successfully",
    "worker_id": 1,
    "phone_number": "1234567890"
  }
  ```

### Delete Worker Phone Number
- **Endpoint**: DELETE `/api/workers/:workerId/phone/:phoneNumber`
- **Note**: Cannot delete the only phone number. If primary is deleted, another number will be set as primary automatically.
- **Output (Success)**:
  ```json
  {
    "message": "Phone number deleted successfully",
    "worker": {
      "id": 1,
      "name": "John Smith",
      "phones": [
        { "phone_number": "5559876543", "is_primary": true }
      ],
      "created_at": "2023-06-15T12:30:45.000Z",
      "updated_at": "2023-06-15T14:45:30.000Z"
    }
  }
  ```
- **Error Responses**:
  - Can't delete only phone (400):
    ```json
    {
      "error": "Cannot delete the only phone number. Worker must have at least one phone number."
    }
    ```
  - Phone not found (404):
    ```json
    {
      "error": "Phone number not found for this worker"
    }
    ```

### Reassign Order to Worker
- **Endpoint**: POST `/api/workers/reassign/:orderId/:newWorkerPhone`
- **Description**: Reassigns an order to a new worker and sends WhatsApp notifications to both the old and new worker
- **Output (Success)**:
  ```json
  {
    "message": "Order reassigned successfully",
    "order_id": "ORD12345",
    "old_worker_phone": "1234567890",
    "new_worker_phone": "5559876543"
  }
  ```
- **Error Responses**:
  - Order not found (404):
    ```json
    {
      "error": "Order not found"
    }
    ```
  - Worker not found (404):
    ```json
    {
      "error": "New worker not found"
    }
    ```

## Project Structure

```
├── server.js            # Main application entry point
├── src/                 # Source code
│   ├── config/          # Configuration files
│   │   └── db.js        # Database connection
│   ├── controllers/     # Controller logic
│   │   ├── orderController.js
│   │   ├── clientController.js
│   │   ├── workerController.js
│   │   └── messageController.js
│   ├── middleware/      # Middleware functions
│   │   └── errorHandler.js
│   ├── routes/          # Route definitions
│   │   ├── orderRoutes.js
│   │   ├── clientRoutes.js
│   │   ├── workerRoutes.js
│   │   └── messageRoutes.js
│   └── utils/           # Utility functions
│       └── orderUtils.js
├── setup.sql            # Database setup script
├── .env                 # Environment variables (not in version control)
└── package.json         # Project dependencies
```

## API Endpoints

### Orders
- `POST /api/orders` - Create an order
- `GET /api/orders` - Get all orders
- `PUT /api/orders/:orderId` - Update an order
- `DELETE /api/orders/:orderId` - Delete an order

### Clients
- `POST /api/clients` - Create a client
- `GET /api/clients` - Get all clients
- `GET /api/clients/:phoneNumber` - Get a client by phone number
- `PUT /api/clients/:phoneNumber` - Update a client
- `DELETE /api/clients/:phoneNumber` - Delete a client

### Messages
- `POST /api/messages` - Create a message
- `GET /api/messages` - Get all messages
- `GET /api/messages/order/:orderId` - Get messages by order ID 