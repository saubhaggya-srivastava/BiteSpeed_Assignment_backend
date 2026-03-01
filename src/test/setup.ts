import { getDatabaseClient } from '../config/database';

beforeAll(async () => {
  // Setup test database connection
  const prisma = getDatabaseClient();
  await prisma.$connect();
});

afterAll(async () => {
  // Cleanup test database connection
  const prisma = getDatabaseClient();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up database before each test
  const prisma = getDatabaseClient();
  await prisma.contact.deleteMany({});
});
