# BS Gold Backend API

## Worker Management API

### Create Worker
```http
POST /api/workers
Content-Type: application/json

{
  "name": "John Doe",
  "phone_numbers": [
    {
      "phone_number": "1234567890",
      "is_primary": true
    },
    {
      "phone_number": "0987654321",
      "is_primary": false
    }
  ]
}
```

Response:
```json
{
  "message": "Worker created successfully",
  "worker": {
    "id": 1,
    "name": "John Doe",
    "phone_numbers": [
      {
        "id": 1,
        "phone_number": "1234567890",
        "is_primary": true
      },
      {
        "id": 2,
        "phone_number": "0987654321",
        "is_primary": false
      }
    ],
    "created_at": "2024-03-21T10:00:00Z",
    "updated_at": "2024-03-21T10:00:00Z"
  }
}
```

### Get All Workers
```http
GET /api/workers
```

Response:
```json
{
  "workers": [
    {
      "id": 1,
      "name": "John Doe",
      "phone_numbers": [
        {
          "id": 1,
          "phone_number": "1234567890",
          "is_primary": true
        },
        {
          "id": 2,
          "phone_number": "0987654321",
          "is_primary": false
        }
      ],
      "created_at": "2024-03-21T10:00:00Z",
      "updated_at": "2024-03-21T10:00:00Z"
    }
  ]
}
```

### Get Worker by ID
```http
GET /api/workers/1
```

Response:
```json
{
  "worker": {
    "id": 1,
    "name": "John Doe",
    "phone_numbers": [
      {
        "id": 1,
        "phone_number": "1234567890",
        "is_primary": true
      },
      {
        "id": 2,
        "phone_number": "0987654321",
        "is_primary": false
      }
    ],
    "created_at": "2024-03-21T10:00:00Z",
    "updated_at": "2024-03-21T10:00:00Z"
  }
}
```

### Update Worker
```http
PUT /api/workers/1
Content-Type: application/json

{
  "name": "John Doe Updated",
  "phone_numbers": [
    {
      "id": 1,
      "phone_number": "1234567890",
      "is_primary": true
    },
    {
      "id": 2,
      "phone_number": "0987654321",
      "is_primary": false
    },
    {
      "phone_number": "5555555555",
      "is_primary": false
    }
  ]
}
```

Response:
```json
{
  "message": "Worker updated successfully",
  "worker": {
    "id": 1,
    "name": "John Doe Updated",
    "phone_numbers": [
      {
        "id": 1,
        "phone_number": "1234567890",
        "is_primary": true
      },
      {
        "id": 2,
        "phone_number": "0987654321",
        "is_primary": false
      },
      {
        "id": 3,
        "phone_number": "5555555555",
        "is_primary": false
      }
    ],
    "created_at": "2024-03-21T10:00:00Z",
    "updated_at": "2024-03-21T11:00:00Z"
  }
}
```

### Delete Worker
```http
DELETE /api/workers/1
```

Response:
```json
{
  "message": "Worker deleted successfully",
  "id": 1
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Name and at least one phone number are required"
}
```

### 404 Not Found
```json
{
  "error": "Worker not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Database Schema

### Workers Table
```sql
CREATE TABLE workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_numbers JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Migration Notes

To migrate existing data to the new schema:

1. Run the `migrate_worker_phone_numbers.sql` script
2. This will:
   - Add a JSON column to store phone numbers
   - Convert existing phone numbers to JSON format
   - Remove the old worker_phone_numbers table
   - Maintain data integrity throughout the migration

## Validation Rules

1. At least one phone number is required when creating a worker
2. The first phone number in the array is considered the primary number
3. Phone numbers must be valid (15 characters or less)
4. Worker names must be non-empty 