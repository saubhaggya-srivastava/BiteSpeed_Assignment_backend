# Database Migrations

This directory contains Prisma migrations for the Identity Reconciliation Service.

## Running Migrations

### Development

```bash
npm run migrate:dev
```

### Production

```bash
npm run migrate
```

## Migration Files

- `20240101000000_init/migration.sql` - Initial migration creating the contact table with all indexes and constraints
- `rollback.sql` - Rollback script for testing purposes (drops all tables)

## Testing Rollback

To test rollback functionality:

```bash
# Apply migration
npm run migrate

# Rollback (manual)
psql $DATABASE_URL -f prisma/migrations/rollback.sql
```

## Schema Changes

The contact table includes:

- Auto-incrementing primary key (id)
- Optional email and phoneNumber fields
- linkedId foreign key for contact relationships
- linkPrecedence enum ('primary' or 'secondary')
- Automatic timestamp management (createdAt, updatedAt)
- Soft deletion support (deletedAt)
- Performance indexes on email, phoneNumber, linkedId, and deletedAt
